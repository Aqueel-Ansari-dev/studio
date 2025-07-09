
'use server';

import { db } from '@/lib/firebase';
import { getAuth } from 'firebase-admin/auth';
import { collection, writeBatch, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';
import { getOrganizationId } from '../common/getOrganizationId';

export async function deleteAllUsers(adminUserId: string): Promise<{ success: boolean; message: string; deletedCount?: number; error?: string }> {
  const organizationId = await getOrganizationId(adminUserId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for the current admin.' };
  }
  
  const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
      return { success: false, message: 'Unauthorized: Only admins can perform this action.' };
  }

  try {
    const adminApp = initializeAdminApp();
    const authAdmin = getAuth(adminApp);
    
    // Fetch users from the organization's subcollection
    const orgUsersCollectionRef = collection(db, 'organizations', organizationId, 'users');
    const orgUsersSnapshot = await getDocs(orgUsersCollectionRef);

    if (orgUsersSnapshot.empty) {
      return { success: true, message: "No users found in this organization to delete.", deletedCount: 0 };
    }

    // Filter out the admin making the request to prevent self-deletion
    const usersToDelete = orgUsersSnapshot.docs.filter(docSnap => docSnap.id !== adminUserId);
    
    if (usersToDelete.length === 0) {
        return { success: true, message: "No other users to delete besides the current admin.", deletedCount: 0 };
    }
    const uidsToDelete = usersToDelete.map(docSnap => docSnap.id);

    // Delete from Firebase Auth in a single batch (max 1000 users per call)
    // For simplicity, we assume less than 1000 users. For more, pagination would be needed.
    const authDeleteResult = await authAdmin.deleteUsers(uidsToDelete);

    if (authDeleteResult.failureCount > 0) {
        console.error('Failed to delete some users from Auth:', authDeleteResult.errors);
    }
    
    // Delete from Firestore in a single batch
    const batch = writeBatch(db);
    usersToDelete.forEach(docSnap => {
      // Delete from org's user collection
      batch.delete(docSnap.ref);
      // Delete from top-level user-to-org mapping
      batch.delete(doc(db, 'users', docSnap.id));
    });
    await batch.commit();

    const successCount = authDeleteResult.successCount;
    let message = `Successfully deleted ${successCount} user(s) from Authentication and Firestore.`;
    if (authDeleteResult.failureCount > 0) {
        message += ` Failed to delete ${authDeleteResult.failureCount} user(s). Check server logs for details.`;
    }

    return { success: true, message, deletedCount: successCount };

  } catch (error) {
    console.error("Error deleting all users:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    
    if (errorMessage.includes('Firebase Admin SDK service account credentials are not set')) {
        return { 
            success: false, 
            message: 'Configuration Error: Firebase Admin SDK credentials not set. Please check your server logs for instructions.',
            error: errorMessage 
        };
    }

    return { success: false, message: `Failed to delete all users: ${errorMessage}`, error: errorMessage };
  }
}
