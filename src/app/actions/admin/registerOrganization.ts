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
  console.log("registerOrganization called with data:", data);
  try {
    const app = initializeAdminApp();
    const auth = admin.auth(app);
    const db = admin.firestore(app);

    if (!data.organizationName || !data.workEmail || !data.passwordUser || !data.selectedPlan || !data.billingCycle || !data.paymentDetails) {
      console.error("Missing required data:", {organizationName: data.organizationName, workEmail: data.workEmail, passwordUser: data.passwordUser, selectedPlan: data.selectedPlan, billingCycle: data.billingCycle, paymentDetails: data.paymentDetails});
      return { success: false, error: "Missing required registration data." };
    }

    // 1. Create the Admin user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: data.workEmail,
      password: data.passwordUser,
      displayName: data.fullName,
      phoneNumber: data.phoneNumber,
      emailVerified: true, // Assuming auto-verification for this flow
    });

    const userId = userRecord.uid;

    // 2. Create the user document in the root /users collection
    // This adapts the multi-tenant flow to the existing single-tenant architecture.
    const userDocRef = db.collection("users").doc(userId);

    await userDocRef.set({
      uid: userId,
      displayName: data.fullName,
      email: data.workEmail,
      phoneNumber: data.phoneNumber,
      role: "admin", // This is the first admin for the new "organization"
      organizationName: data.organizationName, // Store org info on the admin user doc
      organizationDetails: {
        industryType: data.industryType,
        size: data.organizationSize,
      },
      plan: {
        name: data.selectedPlan.name,
        price: data.billingCycle === 'monthly' ? data.selectedPlan.priceMonthly : data.selectedPlan.priceYearly,
        cycle: data.billingCycle,
      },
      billing: {
        subscriptionId: data.paymentDetails.subscriptionId,
        method: data.paymentDetails.method,
        lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
        // Simple renewal date calculation
        nextRenewalDate: admin.firestore.Timestamp.fromMillis(Date.now() + (data.billingCycle === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)),
        status: "active",
      },
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Admin user ${data.workEmail} created for organization ${data.organizationName}.`);

    return {
      success: true,
      userId: userId,
      message: "Organization's admin user registered successfully!",
    };
  } catch (error: any) {
    console.error("Error registering organization:", error);
    if (error.code === "auth/email-already-exists") {
      return { success: false, error: "The provided email is already in use by another account." };
    }
    return { success: false, error: error.message || "An unknown error occurred." };
  }
}
