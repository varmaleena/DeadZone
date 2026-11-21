import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const testRequire = createRequire(require.resolve('@firebase/rules-unit-testing'));
testRequire('firebase/compat/app');
const inMinutes = (minutes) => new Date(Date.now() + minutes * 60000);
testRequire('firebase/compat/firestore');
const doc = (db, path) => db.doc(path);
const setDoc = (ref, data) => ref.set(data);
const getDoc = (ref) => ref.get();
const updateDoc = (ref, data) => ref.update(data);
const arrayUnion = (...values) => ['owner', ...values];
const env = await initializeTestEnvironment({
  projectId: 'demo-deadzone',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
try {
  const owner = env.authenticatedContext('owner').firestore();
  const stranger = env.authenticatedContext('stranger').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const path = 'workspaces/team';
  await assertSucceeds(
    setDoc(doc(owner, path), {
      ownerUid: 'owner',
      memberUids: ['owner'],
      pairingCode: '123456',
      pairingExpiresAt: inMinutes(15),
      name: 'Demo',
    }),
  );
  await assertFails(getDoc(doc(stranger, path)));
  await assertFails(getDoc(doc(guest, path)));
  await assertFails(updateDoc(doc(stranger, path), { memberUids: arrayUnion('stranger'), lastJoinCode: '000000' }));
  await assertFails(updateDoc(doc(stranger, path), { memberUids: ['stranger'], lastJoinCode: '123456' }));
  await assertFails(
    updateDoc(doc(stranger, path), { memberUids: arrayUnion('stranger', 'other'), lastJoinCode: '123456' }),
  );
  await assertSucceeds(updateDoc(doc(stranger, path), { memberUids: arrayUnion('stranger'), lastJoinCode: '123456' }));
  await assertSucceeds(getDoc(doc(stranger, path)));
  // Console workspace lookup: members can list their workspaces, non-members cannot.
  await assertSucceeds(owner.collection('workspaces').where('memberUids', 'array-contains', 'owner').get());
  await assertSucceeds(stranger.collection('workspaces').where('memberUids', 'array-contains', 'stranger').get());
  const outsider = env.authenticatedContext('outsider').firestore();
  await assertFails(outsider.collection('workspaces').get());
  await assertFails(updateDoc(doc(stranger, path), { ownerUid: 'stranger' }));
  await assertFails(updateDoc(doc(stranger, path), { pairingCode: '999999' }));
  await assertSucceeds(setDoc(doc(stranger, path + '/runs/run/checks/check'), { judgedBy: 'pending' }));
  await assertFails(setDoc(doc(guest, path + '/runs/run/checks/guest'), { judgedBy: 'pending' }));
  // Pairing codes expire.
  await assertSucceeds(
    setDoc(doc(owner, 'workspaces/expired'), {
      ownerUid: 'owner',
      memberUids: ['owner'],
      pairingCode: 'ABCDEFGH',
      pairingExpiresAt: inMinutes(-1),
      name: 'Old',
    }),
  );
  await assertFails(
    updateDoc(doc(stranger, 'workspaces/expired'), { memberUids: ['owner', 'stranger'], lastJoinCode: 'ABCDEFGH' }),
  );
  // Subcollection validation.
  await assertFails(setDoc(doc(stranger, path + '/runs/run/checks/bad'), { judgedBy: 'magic' }));
  await assertFails(
    setDoc(doc(stranger, path + '/runs/run/checks/huge'), { judgedBy: 'pending', thumbOnline: 'x'.repeat(180000) }),
  );
  await assertSucceeds(
    setDoc(doc(stranger, path + '/runs/run'), { status: 'running', offlineScore: null, appUrl: 'https://app.test' }),
  );
  await assertFails(setDoc(doc(stranger, path + '/runs/bad'), { status: 'running', offlineScore: 250 }));
  await assertSucceeds(
    setDoc(doc(stranger, path + '/findings/f1'), { title: 'Checkout hangs', status: 'open', fixDiff: '' }),
  );
  await assertFails(setDoc(doc(stranger, path + '/findings/f2'), { title: 'Bad', status: 'deleted' }));
  await assertSucceeds(setDoc(doc(stranger, path + '/fieldEvents/e1'), { judgedBy: 'on_device', screen: 'checkout' }));
  await assertSucceeds(
    setDoc(doc(stranger, path + '/devices/d1'), { platform: 'chrome', nanoStatus: 'available', model: 'Chrome/139' }),
  );
  await assertFails(setDoc(doc(stranger, path + '/devices/d2'), { platform: 'toaster', nanoStatus: 'available' }));
  await assertFails(setDoc(doc(stranger, path + '/secrets/s1'), { anything: true }));

  await assertSucceeds(
    setDoc(doc(owner, 'freshcart_orders/order'), {
      ownerUid: 'owner',
      address: ['Asha', 'Street', 'City', 'PIN'],
      createdAt: 1,
      status: 'queued',
    }),
  );
  await assertFails(getDoc(doc(stranger, 'freshcart_orders/order')));
  await assertFails(
    setDoc(doc(stranger, 'freshcart_orders/forged'), {
      ownerUid: 'owner',
      address: ['a', 'b', 'c', 'd'],
      createdAt: 1,
      status: 'queued',
    }),
  );
  await owner.disableNetwork();
  const queued = doc(owner, 'freshcart_orders/offline-order');
  const acknowledgement = queued.set({
    ownerUid: 'owner',
    address: ['Asha', 'Street', 'City', 'PIN'],
    createdAt: 2,
    status: 'queued',
  });
  const local = await queued.get({ source: 'cache' });
  assert.equal(local.exists, true);
  assert.equal(local.metadata.hasPendingWrites, true);
  await owner.enableNetwork();
  await acknowledgement;
  const synced = await queued.get({ source: 'server' });
  assert.equal(synced.exists, true);
  assert.equal(synced.metadata.hasPendingWrites, false);
  await assertSucceeds(
    queued.set({ ownerUid: 'owner', address: ['Asha', 'Street', 'City', 'PIN'], createdAt: 2, status: 'queued' }),
  );
  await assertFails(queued.update({ address: ['changed', 'b', 'c', 'd'] }));
  console.log('Firestore rules and offline-write/reconnect checks passed.');
} finally {
  await env.cleanup();
}
