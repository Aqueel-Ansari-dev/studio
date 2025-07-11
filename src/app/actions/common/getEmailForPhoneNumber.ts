// src/app/actions/common/getEmailForPhoneNumber.ts
'use server';

import { getAuth } from "firebase-admin/auth";
import { initializeAdminApp } from "@/lib/firebase-admin";

/**
 * A server action to securely find a user's email address using their phone number.
 * @param phoneNumber The user's phone number in E.164 format (e.g., +15551234567).
 * @returns The user's email if found, otherwise null.
 */
export async function getEmailForPhoneNumber(phoneNumber: string): Promise<string | null> {
  try {
    const adminAuth = getAuth(initializeAdminApp());
    const userRecord = await adminAuth.getUserByPhoneNumber(phoneNumber);
    return userRecord.email || null;
  } catch (error: any) {
    // Firebase Admin SDK throws an error if the user is not found.
    // We can log this on the server for debugging but return null to the client.
    console.error(`[Server Action] Error finding user by phone number ${phoneNumber}:`, error.code);
    return null;
  }
}
