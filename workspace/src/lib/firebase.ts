
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
    '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' +
    'CRITICAL: Firebase Config Missing\n' +
    '-------------------------------------------------------------------------------\n' +
    'One or more required Firebase environment variables are missing.\n' +
    'Your app will not connect to Firebase and will likely crash.\n\n' +
    'Please copy the Firebase configuration from your project settings into a\n' +
    '.env.local file in the root of your project, like this:\n\n' +
    'NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"\n' +
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"\n' +
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"\n' +
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"\n' +
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID"\n' +
    'NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"\n\n' +
    '--> IMPORTANT: You MUST restart your development server after creating\n' +
    '    or updating the .env.local file.\n' +
    '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
  );
  // Log current values for debugging
  console.log('Current (incomplete) Firebase config values:', firebaseConfigValues);
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
