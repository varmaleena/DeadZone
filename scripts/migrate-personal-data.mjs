import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (account?.user?.email !== 'nandavarshithareddy@gmail.com') throw Error('Wrong migration account');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const dir = `tmp/private/migration/${project}`;
const source = 'tmp/private/migration/fbailogic26vrt-3003';
async function api(url, method = 'GET', body, extraHeaders = {}) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', ...extraHeaders }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`${response.status}: ${data.error?.message}`);
  return data;
}
const users = (await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet?maxResults=1000`)).users || [];
let owner = users.find(user => user.email === account.user.email);
if (!owner) {
  owner = { localId: 'deadzone-owner-' + crypto.randomUUID(), email: account.user.email, emailVerified: true, displayName: account.user.name || 'Deadzone Owner' };
  const response = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchCreate`, 'POST', { users: [owner] });
  if (response.error?.length) throw Error('Owner user import failed');
  console.log('Created personal owner Firebase identity (no password)');
}
const deployment = JSON.parse(fs.readFileSync(`${dir}/deployment-config.json`));
const docs = JSON.parse(fs.readFileSync(`${source}/firestore-documents.json`)).documents;
const writes = docs.map(doc => {
  if (!/^projects\/fbailogic26vrt-3003\/databases\/\(default\)\/documents\/workspaces\/[^/]+$/.test(doc.name)) throw Error('Unexpected source document');
  const fields = structuredClone(doc.fields);
  fields.ownerUid = { stringValue: owner.localId };
  fields.memberUids = { arrayValue: { values: [{ stringValue: owner.localId }] } };
  fields.pairingCode = { stringValue: crypto.randomBytes(8).toString('hex').toUpperCase() };
  fields.pairingExpiresAt = { timestampValue: new Date(0).toISOString() };
  delete fields.lastJoinCode;
  const oldTarget = fields.targetUrl?.stringValue || '';
  fields.targetUrl = { stringValue: oldTarget.includes('fixed') ? `https://${deployment.sites['freshcart-fixed']}.web.app` : `https://${deployment.sites['freshcart-buggy']}.web.app` };
  return { update: { name: doc.name.replace('fbailogic26vrt-3003', project), fields } };
});
await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`, 'POST', { writes });
fs.writeFileSync(`${dir}/owner-mapping.json`, JSON.stringify({ email: account.user.email, ownerUid: owner.localId, workspaceIds: writes.map(write => write.update.name.split('/').pop()), migratedAt: new Date().toISOString() }, null, 2));
console.log(`Migrated ${writes.length} workspaces with personal ownership and expired old pairing access`);
const remote = JSON.parse(fs.readFileSync(`${source}/remote-config.json`));
delete remote.version;
if (Object.keys(remote.parameters || {}).length || remote.conditions?.length) {
  const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${project}/remoteConfig`;
  const current = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!current.ok) throw Error('Cannot read destination Remote Config');
  const existing = await current.json();
  await api(url, 'PUT', { parameters: { ...existing.parameters, ...remote.parameters }, conditions: [...(existing.conditions || []), ...(remote.conditions || [])] }, { 'If-Match': current.headers.get('etag') });
  console.log('Restored compatible source Remote Config');
} else console.log('Source Remote Config is empty; application defaults preserved');
for (const path of ['apps/console/src/landing.ts', 'apps/console/src/preview.ts', 'apps/extension/panel.html', 'apps/extension/manifest.json', 'README.md', 'tests/freshcart.spec.mjs']) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [oldId, newId] of [['fbailogic26vrt-3003', project], ['dz-3003-buggy', deployment.sites['freshcart-buggy']], ['dz-3003-fixed', deployment.sites['freshcart-fixed']]]) text = text.replaceAll(`https://${oldId}.web.app`, `https://${newId}.web.app`);
  fs.writeFileSync(path, text);
}
console.log('Updated active application URLs and hosted test targets');
