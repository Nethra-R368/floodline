// One board across phones: every event is encrypted on this device (AES-256-GCM, key from the group code)
// and appended to Firestore under boards/{boardId}/events. Firestore security rules make the log append-only
// and accept only signed-in volunteers; the server never sees a family's details.
import { firebaseApp, FB } from './firebase.js';
import { boardKeys, sealEvent, openEvent } from './core/security.js';

let fs = null, db = null, auth = null, unsub = null, current = null;
const sent = new Set();

async function sdk() {
  if (fs) return fs;
  const app = await firebaseApp();
  const [authMod, fsMod] = await Promise.all([import(`${FB}firebase-auth.js`), import(`${FB}firebase-firestore.js`)]);
  auth = authMod.getAuth(app);
  if (!auth.currentUser) await authMod.signInAnonymously(auth);
  try {
    db = fsMod.initializeFirestore(app, { localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }) });
  } catch {
    db = fsMod.getFirestore(app); // already initialised
  }
  fs = fsMod;
  return fs;
}

/** Join (or create) the shared board for a group code. onEvents(events) gets decrypted events from every volunteer. */
export async function joinBoard(code, onEvents, onStatus = () => {}) {
  leaveBoard();
  const keys = await boardKeys(code);
  await sdk();
  current = keys;
  onStatus({ state: 'connecting', code: keys.code });
  const col = fs.collection(db, 'boards', keys.boardId, 'events');
  unsub = fs.onSnapshot(col, async (snap) => {
    const evs = [];
    for (const ch of snap.docChanges()) {
      if (ch.type !== 'added' || sent.has(ch.doc.id)) continue;
      try { evs.push(await openEvent(keys.key, ch.doc.data())); } catch { /* not ours or corrupted: ignore */ }
    }
    if (evs.length) onEvents(evs);
    onStatus({ state: snap.metadata.fromCache ? 'offline' : 'live', code: keys.code, count: snap.size, pending: snap.metadata.hasPendingWrites });
  }, (err) => onStatus({ state: 'error', code: keys.code, error: err.message }));
  return keys.code;
}

/** Encrypt and append events (works offline: Firestore queues the writes and sends them when the network is back). */
export async function pushEvents(evs) {
  if (!current || !evs.length) return;
  const { key, boardId } = current;
  await Promise.all(evs.map(async (ev) => {
    const id = String(ev.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    if (!id || sent.has(id)) return;
    sent.add(id);
    const sealed = await sealEvent(key, ev);
    await fs.setDoc(fs.doc(db, 'boards', boardId, 'events', id), { ...sealed, by: auth.currentUser.uid, ts: fs.serverTimestamp() }).catch(() => { /* already there */ });
  }));
}

export function leaveBoard() {
  if (unsub) { unsub(); unsub = null; }
  current = null;
}
export const sharedCode = () => (current ? current.code : null);
