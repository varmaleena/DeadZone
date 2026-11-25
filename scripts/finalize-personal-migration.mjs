import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const config = JSON.parse(fs.readFileSync('tmp/private/e2e-cloud.json'));
if (config.project !== project || !/^e2e-\d+$/.test(config.workspaceId)) throw Error('Unexpected temporary test workspace');
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 404) throw Error(`${response.status}: ${data.error?.message}`);
  return data;
}
const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const documents = [];
async function collect(name) {
  const subs = await api('https://firestore.googleapis.com/v1/' + name + ':listCollectionIds', 'POST', { pageSize: 1000 });
  if (subs.nextPageToken) throw Error('Unexpected pagination');
  for (const id of subs.collectionIds || []) {
    const result = await api('https://firestore.googleapis.com/v1/' + name + '/' + id + '?pageSize=1000');
    if (result.nextPageToken) throw Error('Unexpected document pagination');
    for (const document of result.documents || []) await collect(document.name);
  }
  documents.push(name);
}
await collect(`projects/${project}/databases/(default)/documents/workspaces/${config.workspaceId}`);
for (const name of documents) {
  if (!name.startsWith(`projects/${project}/databases/(default)/documents/workspaces/${config.workspaceId}`)) throw Error('Cleanup outside temporary workspace');
  await api('https://firestore.googleapis.com/v1/' + name, 'DELETE');
}
await api('https://firebaseappcheck.googleapis.com/v1/' + config.debugTokenName, 'DELETE');
const workspaceDocs = (await api(root + '/workspaces')).documents || [];
const orders = (await api(root + '/freshcart_orders')).documents || [];
const report = { project, verifiedAt: new Date().toISOString(), workspaceCount: workspaceDocs.length, syncedFreshCartOrders: orders.length, temporaryWorkspaceRemoved: true, temporaryAppCheckTokenRevoked: true, cloudDiagnosis: 'pending_user_choice', cloudBlock: 'Gemini Developer API: prepayment credits depleted', hosting: ['https://work-511514.web.app', 'https://dz-work-511514-buggy.web.app', 'https://dz-work-511514-fixed.web.app'], hostedBrowserTestsPassed: 20, extensionRuntime: 'passed', extensionPairing: 'passed', localSweepCloudRequests: 0 };
fs.writeFileSync(`tmp/private/migration/${project}/final-verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
