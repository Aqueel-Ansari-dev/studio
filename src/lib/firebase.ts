
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfigValues = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfigValues.apiKey || !firebaseConfigValues.authDomain || !firebaseConfigValues.projectId) {
  console.error(
    'CRITICAL Firebase Config Missing: One or more of NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID are not set in your environment variables. \n' +
    '1. Please ensure your .env file (e.g., .env.local) is correctly configured with these values. \n' +
    '2. Ensure the variable names are prefixed with NEXT_PUBLIC_ for client-side access. \n' +
    '3. IMPORTANT: You MUST restart your Next.js development server (e.g., stop and rerun `npm run dev`) after creating or updating .env files. \n' +
    'Firebase services will likely fail to initialize correctly, leading to errors like "auth/configuration-not-found".'
  );
  console.log('Current Firebase config values being used by the app (some might be undefined if not set):', firebaseConfigValues);
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfigValues);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };
