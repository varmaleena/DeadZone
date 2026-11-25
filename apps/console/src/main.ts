import { generatePairingCode, initFirebase, PAIRING_CODE_TTL_MS } from '@deadzone/shared';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import QRCode from 'qrcode';
import './style.css';
import { brandName, logoMark, renderLanding, showSignInError } from './landing';

// Old links used /demo; the read-only preview now lives at /preview.
if (location.pathname.startsWith('/demo')) {
  history.replaceState({}, '', location.pathname.replace('/demo', '/preview') + location.search + location.hash);
}

const env = import.meta.env;
const root = document.querySelector<HTMLDivElement>('#app')!;
const services = initFirebase(
  {
    apiKey: String(env.VITE_FIREBASE_API_KEY ?? ''),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID ?? ''),
    appId: String(env.VITE_FIREBASE_APP_ID ?? ''),
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN ?? ''),
  },
  String(env.VITE_RECAPTCHA_SITE_KEY ?? ''),
  env.DEV === true && env.VITE_APP_CHECK_DEBUG === 'true',
);

let workspaceId = '';
let unsubscribers: (() => void)[] = [];

type Row = DocumentData & { id: string };

/** Escapes untrusted text before it is placed in HTML templates. */
const e = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const seconds = (value: unknown) => (value instanceof Timestamp ? value.seconds : 0);
const when = (value: unknown) => (value instanceof Timestamp ? value.toDate().toLocaleString() : 'pending sync');
const byNewest = (field: string) => (a: Row, b: Row) => seconds(b[field]) - seconds(a[field]);

const NAV: [string, string][] = [
  ['/', 'Dashboard'],
  ['/runs', 'Runs'],
  ['/findings', 'Findings'],
  ['/field', 'Field'],
  ['/coverage', 'Coverage'],
  ['/settings', 'Settings'],
];

const STATE_LABEL: Record<string, string> = {
  ok: 'Handled offline',
  infinite_spinner: 'Infinite spinner',
  blank_screen: 'Blank screen',
  raw_error: 'Raw error',
  data_loss: 'Data lost',
  silent_failure: 'Silent failure',
};

function stopListening() {
  unsubscribers.forEach((stop) => stop());
  unsubscribers = [];
}

function content(): HTMLElement {
  return document.querySelector<HTMLElement>('#content')!;
}

function showError(cause: unknown) {
  const target = document.querySelector('#content') ?? root;
  target.innerHTML = `<h1>Unable to load</h1><p role="alert">${e(cause instanceof Error ? cause.message : cause)}</p><button id="retry">Retry</button>`;
  document.querySelector<HTMLButtonElement>('#retry')?.addEventListener('click', () => render());
}

function navigate(path: string) {
  history.pushState({}, '', path);
  render();
}

function layout() {
  document.title = 'Deadzone Console';
  root.innerHTML = `
    <header class="app-bar">
      <a class="logo" href="/" aria-label="Deadzone home">${logoMark}${brandName}</a>
      <span class="app-bar-divider"></span>
      <span class="app-bar-title">Offline-state auditing</span>
      <a class="app-bar-link" href="/preview">Preview</a>
      <button id="logout" class="btn btn-ghost-dark">Sign out</button>
    </header>
    <aside aria-label="Workspace navigation"><div class="workspace-label">Team workspace</div>
      <p>WORKSPACE</p>
      ${NAV.map(([path, label]) => `<a href="${path}">${label}</a>`).join('')}
    </aside>
    <main><div id="content" role="region" aria-live="polite">Loading workspace…</div></main>`;
  document.querySelector<HTMLButtonElement>('#logout')!.onclick = () => void signOut(services.auth);
  root.querySelectorAll<HTMLAnchorElement>('aside a').forEach((link) => {
    link.onclick = (event) => {
      event.preventDefault();
      navigate(link.pathname);
    };
  });
}

function markActiveNav() {
  const top = '/' + (location.pathname.split('/')[1] ?? '');
  root.querySelectorAll<HTMLAnchorElement>('aside a').forEach((link) => {
    if (link.pathname === top) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function listen<T>(source: Parameters<typeof onSnapshot>[0], handler: (rows: Row[], pending: boolean) => T) {
  const stop = onSnapshot(
    source as never,
    { includeMetadataChanges: true },
    (snapshot: { docs: { id: string; data(): DocumentData }[]; metadata: { hasPendingWrites: boolean } }) =>
      handler(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
        snapshot.metadata.hasPendingWrites,
      ),
    showError,
  );
  unsubscribers.push(stop);
}

const ws = (...path: string[]) => collection(services.db, 'workspaces', workspaceId, ...(path as [string]));

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function trendChart(runs: Row[]): string {
  const points = runs
    .filter((r) => typeof r.offlineScore === 'number')
    .sort((a, b) => seconds(a.startedAt) - seconds(b.startedAt))
    .slice(-20);
  if (points.length < 2) return '<p>Run at least two sweeps to see a trend.</p>';
  const width = 520;
  const height = 120;
  const step = width / (points.length - 1);
  const coords = points.map(
    (r, i) => `${Math.round(i * step)},${Math.round(height - (r.offlineScore / 100) * height)}`,
  );
  return `<svg class="trend" viewBox="-6 -6 ${width + 12} ${height + 12}" role="img" aria-label="Offline score over the last ${points.length} runs">
      <polyline fill="none" stroke="#4f46e5" stroke-width="3" points="${coords.join(' ')}"/>
      ${coords.map((c) => `<circle cx="${c.split(',')[0]}" cy="${c.split(',')[1]}" r="4" fill="#4f46e5"/>`).join('')}
    </svg>`;
}

function renderDashboard() {
  let runs: Row[] = [];
  let findings: Row[] = [];
  let fieldCount = 0;
  const draw = () => {
    const latest = [...runs].sort(byNewest('startedAt'))[0];
    const onDevice = runs.reduce((sum, r) => sum + (r.judgedOnDevice ?? 0), 0);
    const cloud = runs.reduce((sum, r) => sum + (r.judgedCloud ?? 0), 0);
    const open = findings.filter((f) => f.status !== 'fixed');
    content().innerHTML = `
      <p class="eyebrow">${e(workspaceId)}</p>
      <h1>Offline readiness</h1>
      <div class="metrics">
        <article class="score"><p>Latest offline score</p><strong>${latest?.offlineScore ?? '—'}</strong><p>${runs.length} runs recorded</p></article>
        <article><p>Open findings</p><strong class="metric-number">${open.length}</strong><p>${findings.length - open.length} fixed</p></article>
        <article><p>Verdicts</p><strong class="metric-number">${onDevice}<span> on device</span></strong><p>${cloud} in cloud · ${fieldCount} Android field events</p></article>
      </div>
      <article><h2>Offline score trend</h2>${trendChart(runs)}</article>
      <div class="section-title"><h2>Open findings</h2><a href="/findings" data-link>View all</a></div>
      <div class="grid">${
        open
          .sort(byNewest('updatedAt'))
          .slice(0, 6)
          .map(
            (f) =>
              `<article><h2>${e(f.title)}</h2><p><span class="severity ${e(f.severity)}">${e(String(f.severity).toUpperCase())}</span> ${e(f.status)}</p><a href="/findings/${encodeURIComponent(f.id)}" data-link>View finding</a></article>`,
          )
          .join('') || '<article>No open findings. Run a sweep and diagnose to populate this list.</article>'
      }</div>`;
    bindLinks();
  };
  listen(query(ws('runs'), orderBy('startedAt', 'desc'), limit(50)), (rows) => {
    runs = rows;
    draw();
  });
  listen(ws('findings'), (rows) => {
    findings = rows;
    draw();
  });
  listen(ws('fieldEvents'), (rows) => {
    fieldCount = rows.length;
    draw();
  });
}

function renderRuns() {
  listen(query(ws('runs'), orderBy('startedAt', 'desc'), limit(100)), (runs, pending) => {
    content().innerHTML = `
      <h1>Runs</h1><p>${pending ? 'Changes waiting to sync' : 'Live updates connected'}</p>
      <div class="grid">${
        runs
          .map(
            (r) => `<article>
              <h2>${e(r.appUrl ?? r.id)}</h2>
              <p>${when(r.startedAt)} · ${e((r.profiles ?? []).join(', '))}${r.isBaseline ? ' · <strong>Baseline</strong>' : ''}</p>
              <p>Score ${r.offlineScore ?? 'pending'} · ${e(r.counts?.total ?? 0)} checks · ${e(r.status)}</p>
              <a href="/runs/${encodeURIComponent(r.id)}" data-link>Open report</a>
            </article>`,
          )
          .join('') || '<article>No runs yet. Pair the extension and run a sweep.</article>'
      }</div>`;
    bindLinks();
  });
}

function renderRunReport(runId: string) {
  const filters = { state: '', severity: '', profile: '' };
  let checks: Row[] = [];
  const draw = (pending = false) => {
    const visible = checks.filter(
      (c) =>
        (!filters.state || (c.verdict?.state ?? 'pending') === filters.state) &&
        (!filters.severity || (c.verdict?.severity ?? 'none') === filters.severity) &&
        (!filters.profile || c.profileId === filters.profile),
    );
    const option = (value: string, label: string, current: string) =>
      `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`;
    content().innerHTML = `
      <a href="/runs" data-link>← Runs</a>
      <h1>Run report</h1><p>${pending ? 'Waiting to sync' : 'Synced'} · ${checks.length} checks</p>
      <div class="filters">
        <label>State <select id="f-state">${option('', 'All', filters.state)}${['pending', ...Object.keys(STATE_LABEL)].map((s) => option(s, STATE_LABEL[s] ?? 'Pending', filters.state)).join('')}</select></label>
        <label>Severity <select id="f-severity">${['', 'high', 'medium', 'low', 'none'].map((s) => option(s, s || 'All', filters.severity)).join('')}</select></label>
        <label>Network <select id="f-profile">${['', 'offline', 'flaky'].map((s) => option(s, s || 'All', filters.profile)).join('')}</select></label>
      </div>
      <div class="grid">${
        visible
          .map(
            (c) => `<article>
              <h2>${e(c.route ?? c.input?.route)} · ${e(c.input?.actionLabel ?? '')}</h2>
              ${c.thumbOnline && c.thumbOffline ? `<div class="thumbs"><img alt="Online" src="data:image/jpeg;base64,${e(c.thumbOnline)}"><img alt="Offline" src="data:image/jpeg;base64,${e(c.thumbOffline)}"></div>` : ''}
              <p><span class="severity ${e(c.verdict?.severity ?? 'none')}">${e(STATE_LABEL[c.verdict?.state] ?? 'Pending')}</span> <span class="badge">${e(
                String(c.judgedBy ?? 'pending')
                  .replace('_', ' ')
                  .toUpperCase(),
              )}</span> ${e(c.profileId ?? '')}</p>
              <p>${e(c.verdict?.evidence ?? c.error ?? '')}</p>
              ${c.regression ? '<strong>REGRESSION</strong>' : ''}
            </article>`,
          )
          .join('') || '<article>No checks match. Keep this page open during a sweep to watch results arrive.</article>'
      }</div>`;
    for (const key of ['state', 'severity', 'profile'] as const) {
      document.querySelector<HTMLSelectElement>(`#f-${key}`)!.onchange = (event) => {
        filters[key] = (event.target as HTMLSelectElement).value;
        draw(pending);
      };
    }
    bindLinks();
  };
  listen(ws('runs', runId, 'checks'), (rows, pending) => {
    checks = rows.sort((a, b) => seconds(a.createdAt) - seconds(b.createdAt));
    draw(pending);
  });
}

function diffHtml(diff: string): string {
  return diff
    .split('\n')
    .map((line) => {
      const cls =
        line.startsWith('+') && !line.startsWith('+++')
          ? 'add'
          : line.startsWith('-') && !line.startsWith('---')
            ? 'del'
            : line.startsWith('@@')
              ? 'hunk'
              : '';
      return `<span class="${cls}">${e(line)}</span>`;
    })
    .join('\n');
}

function renderFindings(findingId?: string) {
  listen(ws('findings'), (rows) => {
    if (findingId) {
      const finding = rows.find((f) => f.id === findingId);
      if (!finding) {
        content().innerHTML = '<a href="/findings" data-link>← Findings</a><h1>Finding unavailable</h1>';
        bindLinks();
        return;
      }
      content().innerHTML = `
        <a href="/findings" data-link>← Findings</a>
        <h1>${e(finding.title)}</h1>
        <article>
          <p><span class="severity ${e(finding.severity)}">${e(String(finding.severity).toUpperCase())}</span> · ${e(finding.status)} · ${e((finding.checks ?? []).map((c: Row) => c.route).join(', '))}</p>
          <h2>Root cause</h2><p>${e(finding.rootCause)}</p>
          <h2>User impact</h2><p>${e(finding.userImpact)}</p>
          <h2>Fix</h2><ul>${(finding.fixSummary ?? []).map((s: string) => `<li>${e(s)}</li>`).join('')}</ul>
          <pre class="diff">${finding.fixDiff ? diffHtml(finding.fixDiff) : 'No patch: link source files in the extension and diagnose again.'}</pre>
          <button id="copy" ${finding.fixDiff ? '' : 'disabled'}>Copy patch</button>
          <button id="toggle">${finding.status === 'fixed' ? 'Reopen' : 'Mark fixed'}</button>
          <p class="small">First seen in run ${e(finding.firstSeenRunId)} · last seen ${e(finding.lastSeenRunId)}${finding.fixedInRunId ? ` · fixed in ${e(finding.fixedInRunId)}` : ''}</p>
        </article>`;
      document.querySelector<HTMLButtonElement>('#copy')!.onclick = () =>
        void navigator.clipboard.writeText(finding.fixDiff ?? '').catch(showError);
      document.querySelector<HTMLButtonElement>('#toggle')!.onclick = () =>
        void updateDoc(doc(services.db, 'workspaces', workspaceId, 'findings', finding.id), {
          status: finding.status === 'fixed' ? 'open' : 'fixed',
          updatedAt: serverTimestamp(),
        }).catch(showError);
      bindLinks();
      return;
    }
    content().innerHTML = `
      <h1>Findings</h1>
      <div class="grid">${
        rows
          .sort(byNewest('updatedAt'))
          .map(
            (f) => `<article><h2>${e(f.title)}</h2>
              <p><span class="severity ${e(f.severity)}">${e(String(f.severity).toUpperCase())}</span> · ${e(f.status)}</p>
              <p>${e(f.rootCause)}</p><a href="/findings/${encodeURIComponent(f.id)}" data-link>View finding</a></article>`,
          )
          .join('') || '<article>No findings yet. Diagnose a sweep in the extension to create them.</article>'
      }</div>`;
    bindLinks();
  });
}

function renderField() {
  listen(query(ws('fieldEvents'), orderBy('createdAt', 'desc'), limit(100)), (rows, pending) => {
    content().innerHTML = `
      <h1>Field events</h1><p>Captured on real Android devices when their network dropped. ${pending ? 'Waiting to sync.' : ''}</p>
      <div class="grid">${
        rows
          .map(
            (f) => `<article>
              ${f.thumb ? `<img class="field-thumb" alt="Screen when offline" src="data:image/jpeg;base64,${e(f.thumb)}">` : ''}
              <h2>${e(f.screen)} · ${e(f.deviceModel)}</h2>
              <p><span class="severity ${e(f.verdict?.severity ?? 'none')}">${e(STATE_LABEL[f.verdict?.state] ?? 'Pending')}</span> <span class="badge">${e(
                String(f.judgedBy ?? 'pending')
                  .replace('_', ' ')
                  .toUpperCase(),
              )}</span></p>
              <p>${e(f.verdict?.evidence ?? '')}</p>
              <p class="small">Captured ${when(f.createdAt)} · synced ${when(f.syncedAt)}</p>
            </article>`,
          )
          .join('') ||
        '<article>No field events yet. Pair the Android app and turn on airplane mode on a screen.</article>'
      }</div>`;
  });
}

function renderCoverage() {
  let devices: Row[] = [];
  let runs: Row[] = [];
  let field: Row[] = [];
  const draw = () => {
    const onDevice =
      runs.reduce((s, r) => s + (r.judgedOnDevice ?? 0), 0) + field.filter((f) => f.judgedBy === 'on_device').length;
    const cloud =
      runs.reduce((s, r) => s + (r.judgedCloud ?? 0), 0) + field.filter((f) => f.judgedBy === 'cloud').length;
    const pendingCount =
      runs.reduce((s, r) => s + (r.counts?.pending ?? 0), 0) + field.filter((f) => f.judgedBy === 'pending').length;
    const total = onDevice + cloud + pendingCount || 1;
    const pct = (n: number) => Math.round((100 * n) / total);
    content().innerHTML = `
      <h1>Coverage</h1>
      <article>
        <h2>Where verdicts ran</h2>
        <div class="coverage-bar" role="img" aria-label="${pct(onDevice)}% on device, ${pct(cloud)}% cloud, ${pct(pendingCount)}% pending">
          <i style="width:${pct(onDevice)}%;background:#0d9488"></i><i style="width:${pct(cloud)}%;background:#2563eb"></i><i style="width:${pct(pendingCount)}%;background:#94a3b8"></i>
        </div>
        <p>On device ${pct(onDevice)}% · Cloud ${pct(cloud)}% · Pending ${pct(pendingCount)}%</p>
        <p class="small">Machines without Gemini Nano still work: their verdicts stay pending offline and are judged in the cloud after reconnecting.</p>
      </article>
      <h2>Devices</h2>
      <div class="grid">${
        devices
          .sort(byNewest('lastSeen'))
          .map(
            (d) =>
              `<article><h2>${e(d.model)}</h2><p>${e(d.platform)} · Nano: ${e(d.nanoStatus)}</p><p class="small">Last seen ${when(d.lastSeen)}</p></article>`,
          )
          .join('') || '<article>No devices reported yet.</article>'
      }</div>`;
  };
  listen(ws('devices'), (rows) => {
    devices = rows;
    draw();
  });
  listen(query(ws('runs'), orderBy('startedAt', 'desc'), limit(200)), (rows) => {
    runs = rows;
    draw();
  });
  listen(ws('fieldEvents'), (rows) => {
    field = rows;
    draw();
  });
}

function renderSettings() {
  const ref = doc(services.db, 'workspaces', workspaceId);
  let timer: ReturnType<typeof setInterval> | undefined;
  unsubscribers.push(() => clearInterval(timer));
  const stop = onSnapshot(
    ref,
    async (snapshot) => {
      const data = snapshot.data() ?? {};
      const expires = data.pairingExpiresAt instanceof Timestamp ? data.pairingExpiresAt.toMillis() : 0;
      const valid = expires > Date.now();
      const qr = valid
        ? await QRCode.toDataURL(JSON.stringify({ workspaceId, code: data.pairingCode }), { margin: 1, width: 180 })
        : '';
      content().innerHTML = `
        <h1>Workspace settings</h1>
        <article>
          <label>Workspace name <input id="ws-name" value="${e(data.name)}"></label>
          <label>App URL under test <input id="ws-target" value="${e(data.targetUrl)}" placeholder="https://your-app.example"></label>
          <button id="save">Save</button>
        </article>
        <article>
          <h2>Pair a device</h2>
          <p>Workspace ID</p><code>${e(workspaceId)}</code>
          ${
            valid
              ? `<p>Pairing code</p><strong class="pairing-code">${e(data.pairingCode)}</strong>
                 <p class="small" id="expiry"></p>
                 <img class="qr" alt="QR code with workspace ID and pairing code" src="${qr}">`
              : '<p>No active pairing code.</p>'
          }
          <button id="rotate">${valid ? 'New code' : 'Generate pairing code'}</button>
          <p class="small">Codes expire after 15 minutes. Enter them in the extension's Setup tab or scan the QR code with the Android app. Keep them private.</p>
        </article>
        <article><h2>Members</h2><p>${(data.memberUids ?? []).length} member(s), including paired devices.</p></article>`;
      document.querySelector<HTMLButtonElement>('#save')!.onclick = () =>
        void updateDoc(ref, {
          name: document.querySelector<HTMLInputElement>('#ws-name')!.value.trim().slice(0, 80) || 'My workspace',
          targetUrl: document.querySelector<HTMLInputElement>('#ws-target')!.value.trim().slice(0, 300),
        }).catch(showError);
      document.querySelector<HTMLButtonElement>('#rotate')!.onclick = () =>
        void updateDoc(ref, {
          pairingCode: generatePairingCode(),
          pairingExpiresAt: Timestamp.fromMillis(Date.now() + PAIRING_CODE_TTL_MS),
        }).catch(showError);
      clearInterval(timer);
      if (valid) {
        const tick = () => {
          const left = Math.max(0, expires - Date.now());
          const label = document.querySelector('#expiry');
          if (label)
            label.textContent = left
              ? `Expires in ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`
              : 'Expired';
        };
        tick();
        timer = setInterval(tick, 1000);
      }
    },
    showError,
  );
  unsubscribers.push(stop);
}

function bindLinks() {
  content()
    .querySelectorAll<HTMLAnchorElement>('a[data-link]')
    .forEach((link) => {
      link.onclick = (event) => {
        event.preventDefault();
        navigate(link.pathname);
      };
    });
}

function render() {
  stopListening();
  markActiveNav();
  content().textContent = 'Loading…';
  const [section, id] = location.pathname.split('/').filter(Boolean);
  try {
    if (!section) renderDashboard();
    else if (section === 'runs') {
      if (id) renderRunReport(id);
      else renderRuns();
    } else if (section === 'findings') renderFindings(id);
    else if (section === 'field') renderField();
    else if (section === 'coverage') renderCoverage();
    else if (section === 'settings') renderSettings();
    else content().innerHTML = '<h1>Page not found</h1><a href="/" data-link>Dashboard</a>';
    bindLinks();
  } catch (cause) {
    showError(cause);
  }
}

// ---------------------------------------------------------------------------
// Sign-in and onboarding
// ---------------------------------------------------------------------------

async function findWorkspace(user: User): Promise<string | null> {
  const matches = await getDocs(
    query(collection(services.db, 'workspaces'), where('memberUids', 'array-contains', user.uid), limit(1)),
  );
  return matches.empty ? null : matches.docs[0].id;
}

function onboarding(user: User) {
  root.innerHTML = `
    <section class="auth-page">
     <div class="auth-card">
      <a class="logo" href="/">${logoMark}${brandName}</a>
      <p class="eyebrow">New workspace</p>
      <h1>Create your workspace</h1>
      <p>Sweeps, findings and Android field events from your team will appear here.</p>
      <form id="onboard">
        <label>Workspace name <input id="name" required maxlength="80" placeholder="e.g. Checkout team"></label>
        <label>App URL to test <input id="target" type="url" placeholder="https://your-app.example"></label>
        <button class="btn btn-primary">Create workspace</button>
        <p id="onboard-error" role="alert"></p>
      </form>
     </div>
    </section>`;
  document.querySelector<HTMLFormElement>('#onboard')!.onsubmit = async (event) => {
    event.preventDefault();
    try {
      const ref = doc(collection(services.db, 'workspaces'));
      await setDoc(ref, {
        name: document.querySelector<HTMLInputElement>('#name')!.value.trim().slice(0, 80),
        targetUrl: document.querySelector<HTMLInputElement>('#target')!.value.trim().slice(0, 300),
        ownerUid: user.uid,
        memberUids: [user.uid],
        pairingCode: generatePairingCode(),
        pairingExpiresAt: Timestamp.fromMillis(Date.now() + PAIRING_CODE_TTL_MS),
        createdAt: serverTimestamp(),
      });
      workspaceId = ref.id;
      layout();
      navigate('/settings');
    } catch (cause) {
      document.querySelector('#onboard-error')!.textContent = String(cause);
    }
  };
}

function loginScreen() {
  renderLanding(root, () => {
    void signInWithPopup(services.auth, new GoogleAuthProvider()).catch((cause) =>
      showSignInError(cause instanceof Error ? cause.message : String(cause)),
    );
  });
}

async function showPreview() {
  stopListening();
  const { renderDemo } = await import('./preview');
  renderDemo(root);
}

onAuthStateChanged(services.auth, async (user) => {
  if (location.pathname.startsWith('/preview')) {
    await showPreview();
    return;
  }
  stopListening();
  if (!user) {
    loginScreen();
    return;
  }
  try {
    const found = await findWorkspace(user);
    if (!found) {
      onboarding(user);
      return;
    }
    workspaceId = found;
    layout();
    render();
  } catch (cause) {
    showError(cause);
  }
});

window.addEventListener('popstate', () => {
  if (location.pathname.startsWith('/preview')) void showPreview();
  else if (services.auth.currentUser && workspaceId) render();
});
