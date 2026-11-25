import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (account?.user?.email !== 'nandavarshithareddy@gmail.com') throw Error('Use the personal Firebase CLI configuration');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const project = 'work-511514';
const dir = `tmp/private/migration/${project}`;
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
async function api(url, method = 'GET', body, allow404 = false) {
  const response = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !(allow404 && response.status === 404)) throw Error(`${method} ${new URL(url).hostname}: ${response.status} ${data.error?.message}`);
  return { status: response.status, data };
}
async function poll(operation, origin) {
  let op = operation;
  for (let i = 0; !op.done && i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    op = (await api(origin + '/' + op.name)).data;
  }
  if (op.error || !op.done) throw Error('Provisioning operation failed: ' + JSON.stringify(op.error || op.name));
  return op.response;
}
for (const service of ['firebaseappcheck.googleapis.com', 'recaptchaenterprise.googleapis.com', 'firebaseremoteconfig.googleapis.com']) {
  const current = await api(`https://serviceusage.googleapis.com/v1/projects/${project}/services/${service}`);
  if (current.data.state !== 'ENABLED') await poll((await api(`https://serviceusage.googleapis.com/v1/projects/${project}/services/${service}:enable`, 'POST', {})).data, 'https://serviceusage.googleapis.com/v1');
  console.log('Ready API:', service);
}
const sites = { console: project, 'freshcart-buggy': 'dz-work-511514-buggy', 'freshcart-fixed': 'dz-work-511514-fixed' };
for (const id of Object.values(sites)) {
  const site = await api(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${id}`, 'GET', undefined, true);
  if (site.status === 404) await api(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites?siteId=${id}`, 'POST', {});
  console.log('Ready Hosting:', id);
}
const apps = (await api(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`)).data.apps || [];
let app = apps.find(app => app.displayName === 'Deadzone Web');
if (!app) app = await poll((await api(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`, 'POST', { displayName: 'Deadzone Web' })).data, 'https://firebase.googleapis.com/v1beta1');
const sdk = (await api(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps/${app.appId}/config`)).data;
fs.writeFileSync(`${dir}/destination-sdk.json`, JSON.stringify(sdk, null, 2));
console.log('Ready Firebase web client:', app.appId);
const authUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
const authConfig = (await api(authUrl)).data;
const domains = [...new Set([...(authConfig.authorizedDomains || []), 'localhost', '127.0.0.1', ...Object.values(sites).flatMap(id => [id + '.web.app', id + '.firebaseapp.com'])])];
await api(authUrl + '?updateMask=authorizedDomains,signIn.anonymous.enabled', 'PATCH', { authorizedDomains: domains, signIn: { anonymous: { enabled: true } } });
console.log('Ready anonymous Authentication and Hosting authorization domains');
const keys = (await api(`https://recaptchaenterprise.googleapis.com/v1/projects/${project}/keys`)).data.keys || [];
let key = keys.find(key => key.displayName === 'Deadzone Web App Check');
if (!key) key = (await api(`https://recaptchaenterprise.googleapis.com/v1/projects/${project}/keys`, 'POST', { displayName: 'Deadzone Web App Check', webSettings: { integrationType: 'SCORE', allowedDomains: domains, allowAllDomains: false } })).data;
const siteKey = key.name.split('/').pop();
await api(`https://firebaseappcheck.googleapis.com/v1/projects/${sdk.messagingSenderId}/apps/${app.appId}/recaptchaEnterpriseConfig?updateMask=siteKey,tokenTtl`, 'PATCH', { siteKey, tokenTtl: '3600s' });
console.log('Ready reCAPTCHA Enterprise App Check');
const env = Object.entries({ VITE_FIREBASE_API_KEY: sdk.apiKey, VITE_FIREBASE_PROJECT_ID: project, VITE_FIREBASE_APP_ID: sdk.appId, VITE_FIREBASE_AUTH_DOMAIN: sdk.authDomain, VITE_RECAPTCHA_SITE_KEY: siteKey, VITE_APP_CHECK_DEBUG: 'false' }).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
for (const path of ['.env.local', 'apps/console/.env.local', 'apps/extension/.env.local', 'apps/spike/.env.local', 'apps/freshcart/.env.local']) fs.writeFileSync(path, env);
const firebaserc = JSON.parse(fs.readFileSync('.firebaserc'));
firebaserc.projects.default = project;
firebaserc.targets[project] = { hosting: Object.fromEntries(Object.entries(sites).map(([target, id]) => [target, [id]])) };
fs.writeFileSync('.firebaserc', JSON.stringify(firebaserc, null, 2) + '\n');
fs.writeFileSync(`${dir}/deployment-config.json`, JSON.stringify({ project, sites, appId: app.appId, siteKey }, null, 2));
console.log('Updated application environments and deployment targets on F:');
const providerUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs`;
const google = await api(providerUrl + '/google.com', 'GET', undefined, true);
if (google.status === 404) {
  try { await api(providerUrl + '?idpId=google.com', 'POST', { enabled: true }); console.log('Enabled Google sign-in'); }
  catch (error) { fs.writeFileSync(`${dir}/google-signin-required.txt`, error.message); console.log('Google sign-in needs OAuth client configuration; recorded privately.'); }
} else if (!google.data.enabled) await api(providerUrl + '/google.com?updateMask=enabled', 'PATCH', { enabled: true });
