import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (!account) throw Error('Firebase CLI sign-in is required for test setup.');
const token = await auth.getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
const config = Object.fromEntries(
  fs
    .readFileSync('apps/extension/.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const project = config.VITE_FIREBASE_PROJECT_ID;
const appId = config.VITE_FIREBASE_APP_ID;
const number = appId.split(':')[1];
const debugToken = crypto.randomUUID();
const appCheckResponse = await fetch(
  `https://firebaseappcheck.googleapis.com/v1/projects/${number}/apps/${appId}/debugTokens`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({ displayName: 'Deadzone end-to-end verification', token: debugToken }),
  },
);
if (!appCheckResponse.ok)
  throw Error(
    `App Check test registration failed: ${appCheckResponse.status} ${(await appCheckResponse.text()).slice(0, 350)}`,
  );
const registration = await appCheckResponse.json();
const workspaceId = `e2e-${Date.now()}`;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pairingCode = [...crypto.randomBytes(8)].map((value) => alphabet[value % alphabet.length]).join('');
const fields = {
  name: { stringValue: 'End-to-end verification (temporary)' },
  ownerUid: { stringValue: workspaceId },
  memberUids: { arrayValue: { values: [{ stringValue: workspaceId }] } },
  pairingCode: { stringValue: pairingCode },
  pairingExpiresAt: { timestampValue: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  targetUrl: { stringValue: 'http://127.0.0.1:5188' },
};
const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/workspaces/${workspaceId}`,
  { method: 'PATCH', headers, body: JSON.stringify({ fields }) },
);
if (!response.ok)
  throw Error(`Temporary test workspace failed: ${response.status} ${(await response.text()).slice(0, 350)}`);
fs.mkdirSync('tmp/private', { recursive: true });
fs.writeFileSync(
  'tmp/private/e2e-cloud.json',
  JSON.stringify({ project, appId, workspaceId, pairingCode, debugToken, debugTokenName: registration.name }, null, 2),
);
console.log('Registered a private App Check test token and temporary verification workspace. No credentials printed.');
