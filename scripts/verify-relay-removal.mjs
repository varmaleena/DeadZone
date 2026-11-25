import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const dir = `tmp/private/migration/${project}`;
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}
const endpoints = {
  run: `https://run.googleapis.com/v2/projects/${project}/locations/asia-south1/services`,
  scheduler: `https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/asia-south1/jobs`,
  buckets: `https://storage.googleapis.com/storage/v1/b?project=${project}`,
  repositories: `https://artifactregistry.googleapis.com/v1/projects/${project}/locations/asia-south1/repositories`,
  topics: `https://pubsub.googleapis.com/v1/projects/${project}/topics`,
  accounts: `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,
  apps: `https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`,
  hostingVersions: `https://firebasehosting.googleapis.com/v1beta1/sites/${project}/versions?pageSize=100`,
  firestoreIndexes: `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/-/indexes`,
  authConfig: `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`,
  preservedGovernor: `https://run.googleapis.com/v2/projects/${project}/locations/us-central1/services/post-code-sci-governor`,
  preservedVyaparsetu: `https://run.googleapis.com/v2/projects/${project}/locations/us-east1/services/vyaparsetu-demo`,
};
const result = Object.fromEntries(await Promise.all(Object.entries(endpoints).map(async ([key, url]) => [key, await api(url)])));
result.authUsers = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet?maxResults=1000`);
result.collections = await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:listCollectionIds`, 'POST', { pageSize: 1000 });
fs.writeFileSync(`${dir}/relay-verification.json`, JSON.stringify(result, null, 2));
for (const [key, value] of Object.entries(result)) {
  const lists = value.data.services || value.data.jobs || value.data.items || value.data.repositories || value.data.topics || value.data.accounts || value.data.apps || value.data.versions || value.data.indexes || value.data.users || value.data.collectionIds;
  console.log(key, value.status, lists ? JSON.stringify(lists.map(x => typeof x === 'string' ? x : x.name || x.email || '[user]').filter(x => key !== 'authUsers' || x !== '[user]')) : '');
  if (key === 'authUsers') console.log('Auth user count:', value.data.users?.length || 0);
}
