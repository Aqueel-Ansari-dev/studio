
'use server';

import { db } from '@/lib/firebase';
import { getAuth } from 'firebase-admin/auth';
import { collection, writeBatch, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';
import type { UserRole } from '@/types/database';

async function verifyAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return userRole === 'admin';
}

export async function deleteAllUsers(adminUserId: string): Promise<{ success: boolean; message: string; deletedCount?: number; error?: string }> {
  const isAuthorized = await verifyAdmin(adminUserId);
  if (!isAuthorized) {
    return { success: false, message: 'Unauthorized: Only admins can perform this action.' };
  }

  try {
    const adminApp = initializeAdminApp();
    const authAdmin = getAuth(adminApp);

    const listUsersResult = await authAdmin.listUsers(1000);
    const allUsers = listUsersResult.users;

    if (allUsers.length === 0) {
      return { success: true, message: "No users found to delete.", deletedCount: 0 };
    }

    // Filter out the admin making the request to prevent self-deletion
    const usersToDelete = allUsers.filter(user => user.uid !== adminUserId);
    
    if (usersToDelete.length === 0) {
        return { success: true, message: "No other users to delete besides the current admin.", deletedCount: 0 };
    }
    const uidsToDelete = usersToDelete.map(user => user.uid);

    // Delete from Firebase Auth in a single batch
    const authDeleteResult = await authAdmin.deleteUsers(uidsToDelete);

    if (authDeleteResult.failureCount > 0) {
        console.error('Failed to delete some users from Auth:', authDeleteResult.errors);
    }
    
    // Delete from Firestore in a single batch
    const batch = writeBatch(db);
    uidsToDelete.forEach(uid => {
      batch.delete(doc(db, 'users', uid));
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
    
    // Custom error message for missing credentials
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
