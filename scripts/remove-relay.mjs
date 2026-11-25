import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const dir = 'tmp/private/migration/' + project;
const inventory = JSON.parse(fs.readFileSync(dir + '/relay-removal-inventory.json'));
const services = JSON.parse(fs.readFileSync(dir + '/relay-services-inventory.json'));
const accounts = JSON.parse(fs.readFileSync(dir + '/service-account-inventory.json'));
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok && response.status !== 404) throw Error(`${method} ${new URL(url).hostname}: ${response.status} ${data.error?.message?.slice(0, 240)}`);
  return data;
}
const buckets = inventory.buckets.data.items.map(b => b.name).filter(name => name.startsWith(project + '-relay-'));
const runServices = services['run/asia-south1'].data.services.filter(s => s.name.startsWith(`projects/${project}/locations/asia-south1/services/relay-dev-`));
const serviceAccounts = accounts.accounts.filter(a => a.email.startsWith('relay-dev-') && a.email.endsWith(`@${project}.iam.gserviceaccount.com`));
const webApps = inventory.webApps.data.apps.filter(a => /relay/i.test(a.displayName));
const userIds = inventory.authUsers.data.users.map(u => u.localId);
const collections = ['adk_check_demo', 'deletionAudit', 'jobs', 'rateLimits', 'workerSweepState'];
const documents = [];
const db = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
async function collect(parent, collection) {
  let page;
  do {
    const url = new URL(parent + '/' + encodeURIComponent(collection));
    url.searchParams.set('pageSize', '100'); url.searchParams.set('showMissing', 'true');
    if (page) url.searchParams.set('pageToken', page);
    const batch = await api(url);
    for (const doc of batch.documents || []) {
      const docUrl = 'https://firestore.googleapis.com/v1/' + doc.name;
      const subs = await api(docUrl + ':listCollectionIds', 'POST', { pageSize: 1000 });
      if (subs.nextPageToken) throw Error('Nested collection pagination requires review before deletion');
      for (const id of subs.collectionIds || []) await collect(docUrl, id);
      documents.push(doc);
    }
    page = batch.nextPageToken;
  } while (page);
}
for (const collection of collections) await collect(db, collection);
fs.writeFileSync(dir + '/relay-firestore-backup.json', JSON.stringify({ project, capturedAt: new Date().toISOString(), documents }, null, 2));
const plan = { project, buckets, services: runServices.map(s => s.name), serviceAccounts: serviceAccounts.map(a => a.email), webApps: webApps.map(a => a.name), firebaseUsers: userIds.length, firestoreDocuments: documents.length, collections, preserved: ['project itself', 'vyaparsetu-demo', 'post-code-sci-governor', 'work-511514-vyaparsetu-invoices', 'shared build repositories and buckets'] };
fs.writeFileSync(dir + '/relay-removal-plan.json', JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan, null, 2));
if (!process.argv.includes('--apply')) process.exit(0);
const log = [];
async function step(name, action) {
  try { await action(); log.push({ name, status: 'done' }); console.log('Removed:', name); }
  catch (error) { log.push({ name, status: 'failed', error: error.message }); console.log('Needs attention:', name, error.message); }
  fs.writeFileSync(dir + '/relay-removal-results.json', JSON.stringify(log, null, 2));
}
await step('scheduled Relay sweep', () => api(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/asia-south1/jobs/relay-dev-sweep`, 'DELETE'));
for (const service of runServices) await step(service.name, () => api('https://run.googleapis.com/v2/' + service.name, 'DELETE'));
await step('Relay website serving', () => api(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${project}/releases`, 'POST', { type: 'SITE_DISABLE' }));
for (const topic of ['relay-jobs', 'relay-jobs-dlq']) await step(topic, () => api(`https://pubsub.googleapis.com/v1/projects/${project}/topics/${topic}`, 'DELETE'));
await step('Relay Firestore documents', async () => {
  for (const doc of documents) {
    if (!doc.name.startsWith(`projects/${project}/databases/(default)/documents/`)) throw Error('Document outside target project');
    await api('https://firestore.googleapis.com/v1/' + doc.name, 'DELETE');
  }
});
await step('25 explicitly approved Firebase Auth accounts', async () => {
  const result = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchDelete`, 'POST', { localIds: userIds, force: true });
  if (result.errors?.length) throw Error(`Auth deletion returned ${result.errors.length} account errors`);
});
for (const bucket of buckets) await step(bucket, async () => {
  const objects = []; let page;
  do {
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${bucket}/o`); url.searchParams.set('versions', 'true'); url.searchParams.set('maxResults', '1000');
    if (page) url.searchParams.set('pageToken', page);
    const batch = await api(url); objects.push(...(batch.items || [])); page = batch.nextPageToken;
  } while (page);
  fs.writeFileSync(dir + '/' + bucket + '-objects.json', JSON.stringify(objects, null, 2));
  for (const object of objects) await api(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object.name)}?generation=${object.generation}`, 'DELETE');
  await api(`https://storage.googleapis.com/storage/v1/b/${bucket}`, 'DELETE');
});
await step('Relay artifact repository', () => api(`https://artifactregistry.googleapis.com/v1/projects/${project}/locations/asia-south1/repositories/relay-dev`, 'DELETE'));
for (const app of webApps) await step('Relay Firebase web app', () => api('https://firebase.googleapis.com/v1beta1/' + app.name + ':remove', 'POST', {}));
await step('Relay service-account IAM bindings', async () => {
  const policyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const policy = await api(policyUrl + ':getIamPolicy', 'POST', {});
  fs.writeFileSync(dir + '/iam-before-relay-removal.json', JSON.stringify(policy, null, 2));
  const members = new Set(serviceAccounts.map(a => 'serviceAccount:' + a.email));
  policy.bindings = (policy.bindings || []).map(b => ({ ...b, members: b.members.filter(m => !members.has(m)) })).filter(b => b.members.length);
  await api(policyUrl + ':setIamPolicy', 'POST', { policy });
});
for (const account of serviceAccounts) await step(account.email, () => api('https://iam.googleapis.com/v1/' + account.name, 'DELETE'));
console.log('Removal pass finished. See the private results file for any failed or pending resources.');
