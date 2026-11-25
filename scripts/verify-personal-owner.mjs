import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('../node_modules/firebase-tools/lib/auth.js');
const account = auth.getGlobalDefaultAccount();
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/userinfo.email', 'openid']);
const project = 'work-511514';
const dir = `tmp/private/migration/${project}`;
const sdk = JSON.parse(fs.readFileSync(`${dir}/destination-sdk.json`));
const owner = JSON.parse(fs.readFileSync(`${dir}/owner-mapping.json`));
async function api(url, method = 'GET', body, authenticated = true) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token.access_token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`${response.status}: ${data.error?.message}`);
  return data;
}
const profile = await api('https://www.googleapis.com/oauth2/v2/userinfo');
if (profile.email !== owner.email || !profile.verified_email) throw Error('Personal Google identity did not match migration owner');
const result = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchCreate`, 'POST', { users: [{ localId: owner.ownerUid, email: owner.email, emailVerified: true, displayName: profile.name, providerUserInfo: [{ providerId: 'google.com', rawId: profile.id, email: profile.email, displayName: profile.name, photoUrl: profile.picture }] }] });
if (result.error?.length) throw Error('Owner Google identity binding failed');
const lookup = await api(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, 'POST', { localId: [owner.ownerUid] });
if (!lookup.users?.[0]?.providerUserInfo?.some(provider => provider.providerId === 'google.com' && provider.rawId === profile.id)) throw Error('Google provider did not match the personal owner');
const rows = await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`, 'POST', { structuredQuery: { from: [{ collectionId: 'workspaces' }], where: { fieldFilter: { field: { fieldPath: 'memberUids' }, op: 'ARRAY_CONTAINS', value: { stringValue: owner.ownerUid } } } } });
const workspaces = rows.filter(row => row.document);
if (workspaces.length !== owner.workspaceIds.length) throw Error('Missing migrated workspaces for owner');
fs.writeFileSync(`${dir}/owner-verification.json`, JSON.stringify({ project, verifiedAt: new Date().toISOString(), googleProviderLinked: true, ownerUidMatches: true, ownedWorkspaces: workspaces.length, note: 'Live Google popup sign-in and dashboard access verified separately in the browser.' }, null, 2));
console.log(`Verified personal Google provider identity and ownership of ${workspaces.length} migrated workspaces`);
