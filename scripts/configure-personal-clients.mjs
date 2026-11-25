import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const dir = `tmp/private/migration/${project}`;
const sdk = JSON.parse(fs.readFileSync(`${dir}/destination-sdk.json`));
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`${response.status}: ${data.error?.message}`);
  return data;
}
const keyInfo = await api(`https://apikeys.googleapis.com/v2/keys:lookupKey?keyString=${encodeURIComponent(sdk.apiKey)}`);
const key = await api(`https://apikeys.googleapis.com/v2/${keyInfo.name}`);
fs.writeFileSync(`${dir}/web-api-key-before.json`, JSON.stringify(key, null, 2));
if (key.restrictions?.apiTargets?.length && !key.restrictions.apiTargets.some(target => target.service === 'firebasevertexai.googleapis.com')) {
  key.restrictions.apiTargets.push({ service: 'firebasevertexai.googleapis.com' });
  await api(`https://apikeys.googleapis.com/v2/${key.name}?updateMask=restrictions`, 'PATCH', { restrictions: key.restrictions, etag: key.etag });
  console.log('Added Firebase AI Logic to Firebase web API key allowlist');
} else console.log('Firebase web key already permits Firebase AI Logic');
const apps = (await api(`https://firebase.googleapis.com/v1beta1/projects/${project}/androidApps`)).apps || [];
let app = apps.find(app => app.packageName === 'com.deadzone.freshcart');
if (!app) {
  let operation = await api(`https://firebase.googleapis.com/v1beta1/projects/${project}/androidApps`, 'POST', { displayName: 'Deadzone Field Android', packageName: 'com.deadzone.freshcart' });
  for (let i = 0; !operation.done && i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    operation = await api('https://firebase.googleapis.com/v1beta1/' + operation.name);
  }
  if (operation.error || !operation.done) throw Error('Android registration failed');
  app = operation.response;
}
const config = await api(`https://firebase.googleapis.com/v1beta1/projects/${project}/androidApps/${app.appId}/config`);
fs.writeFileSync('android/app/google-services.json', Buffer.from(config.configFileContents, 'base64'));
fs.writeFileSync(`${dir}/android-app.json`, JSON.stringify(app, null, 2));
console.log('Registered Android Firebase client and replaced local google-services.json; no APK release claimed');
