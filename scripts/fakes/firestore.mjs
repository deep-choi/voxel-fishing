// check-profile-sync.mjs용 메모리 Firestore. 실제 SDK 대신 ProfileSync가 쓰는 함수만 흉내 낸다.
export const store = new Map();
export const control = { failReads: false, failWrites: false, writes: 0, reads: 0 };
export const reset = () => { store.clear(); Object.assign(control, { failReads: false, failWrites: false, writes: 0, reads: 0 }); };

export const doc = (_db, ...path) => ({ path: path.join('/') });
export const serverTimestamp = () => ({ serverTimestamp: true });
export const getDoc = async ref => {
  control.reads++;
  if (control.failReads) throw Object.assign(new Error('offline'), { code: 'unavailable' });
  const data = store.get(ref.path);
  return { exists: () => data !== undefined, data: () => structuredClone(data) };
};
export const setDoc = async (ref, data) => {
  control.writes++;
  if (control.failWrites) throw Object.assign(new Error('offline'), { code: 'unavailable' });
  store.set(ref.path, structuredClone(data));
};
export const deleteDoc = async ref => {
  if (control.failWrites) throw Object.assign(new Error('offline'), { code: 'unavailable' });
  store.delete(ref.path);
};
