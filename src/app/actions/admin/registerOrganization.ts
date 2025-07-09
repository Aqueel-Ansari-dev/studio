
"use server";

import { initializeAdminApp } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import type { PlanType } from "@/components/registration/choose-plan-step";
import type { PaymentDetails } from "@/components/registration/billing-payment-step";

interface RegisterOrganizationData {
  organizationName: string;
  industryType: "Construction" | "Interior" | "Electrical" | "Civil" | "Fabrication" | "Other";
  organizationSize: "1-10" | "11-50" | "51-200" | "200+";
  fullName: string;
  workEmail: string;
  phoneNumber: string;
  passwordUser: string;
  selectedPlan: PlanType;
  billingCycle: "monthly" | "yearly";
  paymentDetails: PaymentDetails;
}

export async function registerOrganization(data: RegisterOrganizationData) {
  try {
    const app = initializeAdminApp();
    const auth = admin.auth(app);
    const db = admin.firestore(app);
    const batch = db.batch();

    // 1. Create the Organization document
    const orgRef = db.collection("organizations").doc();
    const organizationId = orgRef.id;

    batch.set(orgRef, {
      name: data.organizationName,
      industryType: data.industryType,
      size: data.organizationSize,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: "PENDING_USER_CREATION", // Will be updated after user is created
      planId: 'pro', // Start on Pro trial by default
      subscriptionStatus: 'trialing',
      trialEndsAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day trial
      billingCycle: data.billingCycle,
    });

    // 2. Create the Admin user in Firebase Authentication
    const userPayload: admin.auth.CreateRequest = {
      email: data.workEmail,
      password: data.passwordUser,
      displayName: data.fullName,
      emailVerified: true,
    };
    if (data.phoneNumber && /^\+[1-9]\d{1,14}$/.test(data.phoneNumber)) {
      userPayload.phoneNumber = data.phoneNumber;
    }
    const userRecord = await auth.createUser(userPayload);
    const userId = userRecord.uid;

    // Now update the org with the actual ownerId
    batch.update(orgRef, { ownerId: userId });
    
    // Define the full user profile payload
    const userProfileData = {
        uid: userId,
        displayName: data.fullName,
        email: data.workEmail,
        phoneNumber: data.phoneNumber || null,
        role: "admin" as const,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 3. Create the user document in the organization's subcollection
    const orgUserDocRef = db.collection("organizations").doc(organizationId).collection("users").doc(userId);
    batch.set(orgUserDocRef, userProfileData);
    
    // 4. Create the global user-to-org mapping document.
    // This is crucial for `getOrganizationId` to work correctly on login.
    const userMappingDocRef = db.collection("users").doc(userId);
    batch.set(userMappingDocRef, {
        ...userProfileData,
        organizationId: organizationId, // Add the organizationId here
    });

    // 5. Create the initial System Settings for this organization
    const settingsRef = db.collection('organizations').doc(organizationId).collection('settings').doc('companySettings');
    batch.set(settingsRef, {
        organizationId: organizationId,
        companyName: data.organizationName,
        paidLeaves: 14, // Default value
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Commit all batched writes
    await batch.commit();

    return {
      success: true,
      userId: userId,
      organizationId: organizationId,
      message: "Organization registered successfully!",
    };
  } catch (error: any) {
    console.error("Error registering organization:", error);
    const errorMessage = error.message || "An unknown error occurred.";
    if (error.code === "auth/email-already-exists") {
      return { success: false, error: "The provided email is already in use by another account." };
    }
    if (errorMessage.includes('Firebase Admin SDK service account credentials are not set')) {
      return { 
          success: false, 
          error: 'Configuration Error: Firebase Admin SDK credentials not set. Please check your server logs for detailed setup instructions.' 
      };
    }
    return { success: false, error: errorMessage };
  }
}
