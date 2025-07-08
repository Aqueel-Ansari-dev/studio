
"use server";

import { initializeAdminApp } from "@/lib/firebase-admin";
import admin from "firebase-admin";

interface CreateProjectData {
  orgId: string;
  name: string;
  description: string;
  budget: number;
  startDate: string; // ISO string from Date
  endDate: string; // ISO string from Date
  location: string;
  // Add any other necessary fields, e.g., createdByUserId
}

export async function createProject(data: CreateProjectData) {
  try {
    const app = initializeAdminApp();
    const db = admin.firestore(app);

    // Basic validation
    if (
      !data.orgId ||
      !data.name ||
      !data.description ||
      data.budget === undefined ||
      data.budget <= 0 ||
      !data.startDate ||
      !data.endDate ||
      !data.location
    ) {
      return { success: false, error: "Missing or invalid project data." };
    }

    // Convert date strings to Firestore Timestamps
    const startDateTimestamp = admin.firestore.Timestamp.fromDate(new Date(data.startDate));
    const endDateTimestamp = admin.firestore.Timestamp.fromDate(new Date(data.endDate));

    // Create a new project document within the organization's projects subcollection
    const projectRef = db
      .collection("organizations")
      .doc(data.orgId)
      .collection("projects")
      .doc(); // Let Firestore generate a new ID for the project

    await projectRef.set({
      projectId: projectRef.id,
      orgId: data.orgId,
      name: data.name,
      description: data.description,
      budget: data.budget,
      startDate: startDateTimestamp,
      endDate: endDateTimestamp,
      location: data.location,
      status: "active", // Default status
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // createdBy: data.createdByUserId, // You would pass this from the client-side session
    });

    console.log(`Project '${data.name}' created for organization ${data.orgId}`);

    return { success: true, projectId: projectRef.id, message: "Project created successfully." };
  } catch (error: any) {
    console.error("Error creating project:", error);
    return { success: false, error: error.message || "An unknown error occurred." };
  }
}
