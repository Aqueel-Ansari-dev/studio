
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfigValues = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// A more direct check for the essential keys, now including storageBucket.
if (!firebaseConfigValues.apiKey || !firebaseConfigValues.projectId || !firebaseConfigValues.storageBucket) {
  let missingKeys: string[] = [];
  if (!firebaseConfigValues.apiKey) missingKeys.push("API Key");
  if (!firebaseConfigValues.projectId) missingKeys.push("Project ID");
  if (!firebaseConfigValues.storageBucket) missingKeys.push("Storage Bucket");

  // A loud and clear error message to guide the user.
  console.error(
    `
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    CRITICAL: FIREBASE CONFIGURATION MISSING
    -------------------------------------------------------------------------------
    Your Firebase ${missingKeys.join(' and ')} is missing. The application cannot connect
    to Firebase services properly.

    SOLUTION:
    1. Find your Firebase project configuration in the Firebase Console.
       Go to Project Settings > General > Your apps > Web app > SDK setup and configuration.

    2. Create or update your file named '.env.local' in the root of your project.

    3. Copy the contents from the '.env' template file into '.env.local' and
       replace the placeholder values with your actual Firebase credentials.
       Ensure NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is filled out.

    4. IMPORTANT: Restart your development server after creating or updating
       the .env.local file for the changes to take effect.
    !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    `
  );
  // Also log the values for easier debugging
  console.log('Current (incomplete) Firebase config values being read:', firebaseConfigValues);
}


let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfigValues);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
