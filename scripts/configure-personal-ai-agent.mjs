import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const dir = `tmp/private/migration/${project}`;
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`${response.status}: ${data.error?.message}`);
  return data;
}
const operation = await api(`https://serviceusage.googleapis.com/v1beta1/projects/${project}/services/firebasevertexai.googleapis.com:generateServiceIdentity`, 'POST', {});
if (!operation.done || !operation.response?.email) throw Error('AI service identity was not provisioned immediately');
const email = operation.response.email;
if (email !== 'service-798642284156@gcp-sa-firebasevertexai.iam.gserviceaccount.com') throw Error('Unexpected AI service identity');
const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
const policy = await api(url + ':getIamPolicy', 'POST', { options: { requestedPolicyVersion: 3 } });
fs.writeFileSync(`${dir}/iam-before-ai-service-consumer.json`, JSON.stringify(policy, null, 2));
const role = 'roles/serviceusage.serviceUsageConsumer';
const member = 'serviceAccount:' + email;
let binding = policy.bindings.find(binding => binding.role === role && !binding.condition);
if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
if (!binding.members.includes(member)) {
  binding.members.push(member);
  await api(url + ':setIamPolicy', 'POST', { policy });
  console.log('Granted the Firebase AI Logic service agent Service Usage Consumer in the personal project');
} else console.log('AI Logic service agent already has Service Usage Consumer');
console.log('Personal login identity fields:', Object.keys(account.user).join(', '));
