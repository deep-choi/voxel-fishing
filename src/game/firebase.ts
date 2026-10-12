import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 브라우저용 공개 Firebase 설정. 비밀 키나 관리자 자격 증명을 넣지 않는다.
const app = getApps()[0] ?? initializeApp({
  apiKey: 'AIzaSyBnch2jy8iyjpHn6J3DwJ6oNV1gXLHSanw',
  authDomain: 'voxel-fishing-choi.firebaseapp.com',
  projectId: 'voxel-fishing-choi',
  appId: '1:1057818528056:web:ab02cd101249540ec319cd',
  messagingSenderId: '1057818528056',
});
export const auth = getAuth(app);
export const db = getFirestore(app);
auth.languageCode = 'ko';
