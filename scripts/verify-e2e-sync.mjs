import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);
const config = JSON.parse(fs.readFileSync('tmp/private/e2e-cloud.json', 'utf8'));
const base = `https://firestore.googleapis.com/v1/projects/${config.project}/databases/(default)/documents/workspaces/${config.workspaceId}`;
const headers = { Authorization: `Bearer ${token.access_token}` };
const get = async (url) => {
  const response = await fetch(url, { headers });
  if (!response.ok) throw Error(`Verification request failed ${response.status}`);
  return response.json();
};
const runs = (await get(base + '/runs')).documents || [];
const findings = (await get(base + '/findings')).documents || [];
const devices = (await get(base + '/devices')).documents || [];
const report = {
  verifiedAt: new Date().toISOString(),
  workspaceId: config.workspaceId,
  runs: [],
  findings: findings.length,
  devices: devices.length,
};
for (const run of runs) {
  const checks = (await get('https://firestore.googleapis.com/v1/' + run.name + '/checks')).documents || [];
  report.runs.push({
    id: run.name.split('/').pop(),
    status: run.fields.status?.stringValue,
    score: run.fields.offlineScore?.integerValue || run.fields.offlineScore?.doubleValue,
    checks: checks.map((check) => ({
      route: check.fields.route?.stringValue,
      judgedBy: check.fields.judgedBy?.stringValue,
    })),
  });
}
if (
  !report.runs.some((run) => run.checks.some((check) => check.route === '/checkout' && check.judgedBy === 'cloud')) ||
  !findings.length ||
  !devices.length
)
  throw Error('Server records did not confirm the full synced run');
fs.writeFileSync('output/extension-cloud-e2e/server-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--cleanup')) {
  if (!config.workspaceId.startsWith('e2e-')) throw Error('Refusing cleanup outside the temporary test workspace');
  const documents = [];
  for (const run of runs) {
    for (const check of (await get('https://firestore.googleapis.com/v1/' + run.name + '/checks')).documents || [])
      documents.push(check.name);
    documents.push(run.name);
  }
  documents.push(
    ...findings.map((doc) => doc.name),
    ...devices.map((doc) => doc.name),
    `projects/${config.project}/databases/(default)/documents/workspaces/${config.workspaceId}`,
  );
  for (const name of documents) {
    if (!name.includes(`/documents/workspaces/${config.workspaceId}`)) throw Error('Unexpected cleanup target');
    const response = await fetch('https://firestore.googleapis.com/v1/' + name, { method: 'DELETE', headers });
    if (!response.ok) throw Error('Temporary data cleanup failed ' + response.status);
  }
  const response = await fetch('https://firebaseappcheck.googleapis.com/v1/' + config.debugTokenName, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) throw Error('Test token cleanup failed ' + response.status);
  console.log('Removed temporary workspace records and revoked the temporary App Check token.');
}
