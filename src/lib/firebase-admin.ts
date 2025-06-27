
import admin from 'firebase-admin';

// This function initializes the Firebase Admin SDK.
// It should only be called in server-side code (Server Actions, API routes).
export function initializeAdminApp() {
  // Check if the app is already initialized to prevent errors.
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // The service account key is expected to be in an environment variable.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  if (!serviceAccount) {
    console.error(
      `
      !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      CRITICAL: FIREBASE ADMIN SDK CONFIGURATION MISSING
      -------------------------------------------------------------------------------
      The Firebase Admin SDK requires service account credentials to function.
      These were not found in the 'FIREBASE_SERVICE_ACCOUNT' environment variable.

      SOLUTION:
      1. Go to your Firebase Project Settings > Service accounts.
      2. Click "Generate new private key" to download a JSON file.
      3. Open your '.env.local' file.
      4. Create a new variable named FIREBASE_SERVICE_ACCOUNT.
      5. Copy the ENTIRE contents of the downloaded JSON file and paste it as the value
         for FIREBASE_SERVICE_ACCOUNT. It should look like:
         FIREBASE_SERVICE_ACCOUNT='{"type": "service_account", "project_id": "...", ...}'

      6. IMPORTANT: Restart your development server.
      !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      `
    );
    throw new Error("Firebase Admin SDK service account credentials are not set.");
  }

  // Initialize the app with the service account credentials.
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
