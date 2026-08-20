// firebase.ts — Firebase v9 Modular
// Proyecto: oritrace-d383e (contiene todos los datos originales)
// Archivos (PDFs/docs): Cloudinary — configurado en App.tsx
import { initializeApp, getApps } from 'firebase/app';
import { getAuth }                 from 'firebase/auth';
import { getFirestore }            from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyDW1kIiBrnDf8Hu_L5rCT41rfmV2_sQXwE",
  authDomain:        "oritrace-d383e.firebaseapp.com",
  projectId:         "oritrace-d383e",
  storageBucket:     "oritrace-d383e.firebasestorage.app",
  messagingSenderId: "848694444863",
  appId:             "1:848694444863:web:62be780b822473426e498a",
  measurementId:     "G-C0T608SNE9",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);