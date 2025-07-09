# FieldOps Mobile

This directory contains the starting point for the mobile version of **FieldOps**. It uses [Expo](https://expo.dev/) and React Native. The code is intentionally minimal and should be expanded to match the full Next.js functionality.

## Setup

1. Install dependencies:

   ```bash
   cd mobile
   npm install
   ```

2. Provide Firebase configuration using Expo environment variables. Create a file named `.env` in `mobile/` with the following keys:

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=your_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. Start the development server:

   ```bash
   npm start
   ```

Expo will guide you to open the app on Android, iOS, or the web.

## Notes

- `src/lib/firebase.ts` initializes Firebase using values from `app.config.js`.
- `src/context/auth-context.tsx` implements a simplified authentication context using `AsyncStorage`.
- `src/context/offline-queue.tsx` stores actions locally and syncs them when connectivity returns.
- This scaffold only covers authentication and basic offline handling; replicate the remaining Next.js functionality (tasks, expenses, etc.) as needed.
