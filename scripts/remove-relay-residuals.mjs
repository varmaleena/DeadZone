import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const dir = `tmp/private/migration/${project}`;
const verified = JSON.parse(fs.readFileSync(`${dir}/relay-verification.json`));
async function api(url, method, body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 404) throw Error(`${response.status}: ${data.error?.message}`);
  return data;
}
if (verified.hostingVersions.data.nextPageToken || verified.firestoreIndexes.data.nextPageToken) throw Error('Inventory pagination requires review');
for (const version of verified.hostingVersions.data.versions || []) {
  if (!version.name.startsWith(`sites/${project}/versions/`)) throw Error('Wrong Hosting site');
  await api(`https://firebasehosting.googleapis.com/v1beta1/${version.name}`, 'DELETE');
  console.log('Deleted Hosting version:', version.name);
}
for (const index of verified.firestoreIndexes.data.indexes || []) {
  if (!index.name.startsWith(`projects/${project}/databases/(default)/collectionGroups/`) || !/\/(items|notifications|cases|packets)\/indexes\//.test(index.name)) throw Error('Unexpected index');
  await api(`https://firestore.googleapis.com/v1/${index.name}`, 'DELETE');
  console.log('Deleted Relay index:', index.name);
}
const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
const config = await api(configUrl, 'GET');
await api(configUrl + '?updateMask=authorizedDomains', 'PATCH', { authorizedDomains: config.authorizedDomains.filter(domain => domain !== 'work-511514--relay-review-zamftmre.web.app') });
console.log('Removed Relay preview authorization domain');
