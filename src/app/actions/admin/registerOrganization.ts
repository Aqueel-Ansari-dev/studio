
"use server";

import { initializeAdminApp } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { PlanType } from "@/components/registration/choose-plan-step";
import { PaymentDetails } from "@/components/registration/billing-payment-step";

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

    // 1. Validate incoming data (basic validation, more robust validation can be added)
    if (
      !data.organizationName ||
      !data.workEmail ||
      !data.passwordUser ||
      !data.selectedPlan
    ) {
      return { success: false, error: "Missing required registration data." };
    }

    // 2. Create the first Admin user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: data.workEmail,
      password: data.passwordUser,
      displayName: data.fullName,
      phoneNumber: data.phoneNumber,
      emailVerified: false, // Can be set to true if you have an email verification flow
      disabled: false,
    });

    const userId = userRecord.uid;

    // 3. Create a new organization document in Firestore
    const newOrgRef = db.collection("organizations").doc(); // Let Firestore generate a new ID
    const orgId = newOrgRef.id;

    await newOrgRef.set({
      orgId: orgId,
      name: data.organizationName,
      industryType: data.industryType,
      size: data.organizationSize,
      plan: data.selectedPlan.name,
      planDetails: {
        id: data.selectedPlan.name, // Using name as ID for simplicity, can be a proper plan ID
        priceMonthly: data.selectedPlan.priceMonthly,
        priceYearly: data.selectedPlan.priceYearly,
        billingCycle: data.billingCycle,
        features: data.selectedPlan.features,
      },
      billing: {
        subscriptionId: data.paymentDetails.subscriptionId, // From payment gateway
        method: data.paymentDetails.method,
        lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
        nextRenewalDate: admin.firestore.Timestamp.fromMillis(Date.now() + (data.billingCycle === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)), // Approx 1 year/month from now
        status: "active",
        billingAddress: data.paymentDetails.billingAddress || null,
        // Store only essential non-sensitive payment info if needed, e.g., last4 of card
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    });

    // 4. Create the initial admin user document within the organization's subcollection
    const userDocRef = db.collection("organizations").doc(orgId).collection("users").doc(userId);

    await userDocRef.set({
      uid: userId,
      fullName: data.fullName,
      email: data.workEmail,
      phoneNumber: data.phoneNumber,
      role: "orgAdmin", // Assign the initial admin role
      organizationId: orgId, // Redundant but good for quick queries
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Set custom claims on the admin user's Firebase Authentication token
    await auth.setCustomUserClaims(userId, {
      orgId: orgId,
      role: "orgAdmin",
    });

    console.log(
      `Organization ${data.organizationName} registered with ID: ${orgId}`
    );
    console.log(`Admin user ${data.workEmail} created with UID: ${userId}`);

    return {
      success: true,
      orgId: orgId,
      userId: userId,
      message: "Organization registered successfully!",
    };
  } catch (error: any) {
    console.error("Error registering organization:", error);
    // Handle specific Firebase errors (e.g., email-already-in-use)
    if (error.code === "auth/email-already-in-use") {
      return { success: false, error: "The provided email is already in use." };
    }
    return { success: false, error: error.message || "An unknown error occurred." };
  }
}
