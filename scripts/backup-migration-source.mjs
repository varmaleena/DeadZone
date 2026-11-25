import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'fbailogic26vrt-3003';
const dir = `tmp/private/migration/${project}`;
fs.mkdirSync(dir, { recursive: true });
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
async function request(url, options = {}) {
  const response = await fetch(url, { headers, ...options });
  if (!response.ok) throw Error(`Source backup failed: ${response.status} ${new URL(url).hostname}`);
  return response.json();
}
const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const documents = [];
async function walk(parent) {
  let collectionPage;
  do {
    const ids = await request(parent + ':listCollectionIds', { method: 'POST', body: JSON.stringify({ pageSize: 1000, ...(collectionPage ? { pageToken: collectionPage } : {}) }) });
    for (const id of ids.collectionIds || []) {
      let page;
      do {
        const url = new URL(parent + '/' + encodeURIComponent(id));
        url.searchParams.set('pageSize', '100');
        url.searchParams.set('showMissing', 'true');
        if (page) url.searchParams.set('pageToken', page);
        const result = await request(url);
        for (const doc of result.documents || []) { documents.push(doc); await walk('https://firestore.googleapis.com/v1/' + doc.name); }
        page = result.nextPageToken;
      } while (page);
    }
    collectionPage = ids.nextPageToken;
  } while (collectionPage);
}
await walk(root);
fs.writeFileSync(`${dir}/firestore-documents.json`, JSON.stringify({ sourceProject: project, capturedAt: new Date().toISOString(), documents }, null, 2));
const remoteConfig = await request(`https://firebaseremoteconfig.googleapis.com/v1/projects/${project}/remoteConfig`);
fs.writeFileSync(`${dir}/remote-config.json`, JSON.stringify(remoteConfig, null, 2));
const authConfig = await request(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`);
fs.writeFileSync(`${dir}/auth-config.json`, JSON.stringify(authConfig, null, 2));
fs.writeFileSync(`${dir}/inventory.json`, JSON.stringify({ sourceProject: project, destinationProject: 'work-511514', capturedAt: new Date().toISOString(), firestoreDocuments: documents.length, hostingSites: [project, 'dz-3003-buggy', 'dz-3003-fixed'], localRoot: 'F:/DEADZONE', status: 'Backup only; destination unchanged' }, null, 2));
console.log(`Backed up ${documents.length} Firestore documents, Remote Config and Authentication settings to the ignored private migration folder on F:.`);
