import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { signInAnonymously, type Auth } from 'firebase/auth';
import { isResolvedBy, score, type AuditResult, type Finding } from './audit';

/** Pairing codes: 8 characters, no ambiguous letters/digits (0/O, 1/I). */
export const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
export const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

export function generatePairingCode(): string {
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => PAIRING_CODE_ALPHABET[v % PAIRING_CODE_ALPHABET.length]).join('');
}

export async function ensureClient(auth: Auth) {
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

export interface RunOptions {
  profiles: string[];
  promptVersion: string;
}

export function startRun(db: Firestore, workspaceId: string, appUrl: string, options: RunOptions) {
  const ref = doc(collection(db, 'workspaces', workspaceId, 'runs'));
  void setDoc(ref, {
    appUrl,
    platform: 'chrome',
    status: 'running',
    startedAt: serverTimestamp(),
    profiles: options.profiles,
    promptVersion: options.promptVersion,
    counts: { total: 0, ok: 0, high: 0, medium: 0, low: 0, pending: 0 },
    isBaseline: false,
  }).catch((error) => console.error('Run sync failed', error));
  return ref;
}

export async function writeCheck(
  db: Firestore,
  workspaceId: string,
  runId: string,
  result: AuditResult,
  thumbs?: { thumbOnline: string; thumbOffline: string },
) {
  // JSON round-trip drops undefined values, which Firestore rejects.
  const clean = JSON.parse(
    JSON.stringify({
      ...result,
      ...thumbs,
      route: result.input.route,
      actionId: result.input.actionId,
      profileId: result.input.profileId,
    }),
  );
  await setDoc(doc(db, 'workspaces', workspaceId, 'runs', runId, 'checks', result.input.id), {
    ...clean,
    createdAt: serverTimestamp(),
  });
}

export function runCounts(checks: AuditResult[]) {
  return {
    total: checks.length,
    ok: checks.filter((c) => c.verdict?.state === 'ok').length,
    high: checks.filter((c) => c.verdict?.severity === 'high').length,
    medium: checks.filter((c) => c.verdict?.severity === 'medium').length,
    low: checks.filter((c) => c.verdict?.severity === 'low').length,
    pending: checks.filter((c) => c.judgedBy === 'pending').length,
  };
}

export async function finishRun(db: Firestore, workspaceId: string, runId: string, checks: AuditResult[]) {
  await setDoc(
    doc(db, 'workspaces', workspaceId, 'runs', runId),
    {
      status: 'complete',
      finishedAt: serverTimestamp(),
      offlineScore: score(checks),
      counts: runCounts(checks),
      judgedOnDevice: checks.filter((c) => c.judgedBy === 'on_device').length,
      judgedCloud: checks.filter((c) => c.judgedBy === 'cloud').length,
    },
    { merge: true },
  );
}

export function observeSync(
  db: Firestore,
  workspaceId: string,
  runId: string,
  listener: (pending: number) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, 'workspaces', workspaceId, 'runs', runId, 'checks'),
    { includeMetadataChanges: true },
    (snapshot) => listener(snapshot.docs.filter((d) => d.metadata.hasPendingWrites).length),
    onError,
  );
}

export async function saveBaseline(db: Firestore, workspaceId: string, runId: string, checks: AuditResult[]) {
  if (score(checks) !== 100) throw new Error('Only a fully judged, fully passing run can become the baseline.');
  const batch = writeBatch(db);
  batch.set(doc(db, 'workspaces', workspaceId), { baselineRunId: runId }, { merge: true });
  batch.set(doc(db, 'workspaces', workspaceId, 'runs', runId), { isBaseline: true }, { merge: true });
  await batch.commit();
}

/** Loads the workspace baseline run's checks, so regressions work across machines. */
export async function loadBaseline(db: Firestore, workspaceId: string): Promise<AuditResult[] | null> {
  const workspace = await getDoc(doc(db, 'workspaces', workspaceId));
  const runId = workspace.data()?.baselineRunId;
  if (typeof runId !== 'string') return null;
  const checks = await getDocs(collection(db, 'workspaces', workspaceId, 'runs', runId, 'checks'));
  return checks.docs
    .map((d) => d.data() as Partial<AuditResult>)
    .filter((c): c is AuditResult => !!c.input && 'verdict' in c)
    .map(({ input, verdict, judgedBy }) => ({ input, verdict, judgedBy }));
}

/**
 * Writes diagnosed findings with stable IDs (no duplicates on re-diagnosis). A finding that
 * was marked fixed and appears again becomes "regressed".
 */
export async function writeFindings(db: Firestore, workspaceId: string, runId: string, findings: Finding[]) {
  for (const finding of findings) {
    const ref = doc(db, 'workspaces', workspaceId, 'findings', finding.id);
    const existing = await getDoc(ref);
    const previous = existing.data();
    const { id: _id, ...data } = finding;
    await setDoc(
      ref,
      {
        ...JSON.parse(JSON.stringify(data)),
        platforms: arrayUnion('chrome'),
        status: previous?.status === 'fixed' ? 'regressed' : 'open',
        lastSeenRunId: runId,
        updatedAt: serverTimestamp(),
        ...(existing.exists() ? {} : { firstSeenRunId: runId, createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
  }
}

/** After a sweep, marks open findings as fixed when all of their checks now pass. */
export async function resolveFindings(db: Firestore, workspaceId: string, runId: string, results: AuditResult[]) {
  const open = await getDocs(
    query(collection(db, 'workspaces', workspaceId, 'findings'), where('status', 'in', ['open', 'regressed'])),
  );
  let resolved = 0;
  for (const finding of open.docs) {
    const data = finding.data() as Pick<Finding, 'checks'>;
    if (Array.isArray(data.checks) && isResolvedBy(data, results)) {
      await updateDoc(finding.ref, { status: 'fixed', fixedInRunId: runId, updatedAt: serverTimestamp() });
      resolved++;
    }
  }
  return resolved;
}

export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown';

/** Records which devices can judge on-device, for the console's coverage page. */
export async function reportDevice(
  db: Firestore,
  workspaceId: string,
  deviceId: string,
  device: { platform: 'chrome' | 'android'; model: string; nanoStatus: NanoStatus },
) {
  await setDoc(
    doc(db, 'workspaces', workspaceId, 'devices', deviceId),
    { ...device, lastSeen: serverTimestamp() },
    { merge: true },
  );
}

export async function pairWorkspace(db: Firestore, auth: Auth, workspaceId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(workspaceId) || !PAIRING_CODE_PATTERN.test(normalized)) {
    throw new Error('Enter the workspace ID and the 8-character pairing code from the console.');
  }
  const user = await ensureClient(auth);
  await updateDoc(doc(db, 'workspaces', workspaceId), {
    memberUids: arrayUnion(user.uid),
    lastJoinCode: normalized,
  });
}
