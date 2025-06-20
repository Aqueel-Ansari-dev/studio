
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { Notification, NotificationType, RelatedItemType, UserRole, Employee, Project } from '@/types/database';

/**
 * Fetches the display name for a user.
 */
async function getUserDisplayName(userId: string): Promise<string> {
  if (!userId) return 'Unknown User';
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data() as Employee;
      return userData.displayName || userData.email || userId;
    }
    return userId; // Fallback to ID if not found
  } catch (error) {
    console.error(`Error fetching display name for user ${userId}:`, error);
    return userId; // Fallback to ID on error
  }
}

/**
 * Fetches the name for a project.
 */
async function getProjectName(projectId: string): Promise<string> {
  if (!projectId) return 'Unknown Project';
  try {
    const projectDoc = await getDoc(doc(db, 'projects', projectId));
    if (projectDoc.exists()) {
      const projectData = projectDoc.data() as Project;
      return projectData.name || projectId;
    }
    return projectId; // Fallback to ID if not found
  } catch (error) {
    console.error(`Error fetching name for project ${projectId}:`, error);
    return projectId; // Fallback to ID on error
  }
}


/**
 * Creates a single notification document in Firestore.
 */
export async function createSingleNotification(
  targetUserId: string,
  type: NotificationType,
  title: string,
  body: string,
  relatedItemId?: string,
  relatedItemType?: RelatedItemType
): Promise<void> {
  if (!targetUserId) {
    console.warn('createSingleNotification: targetUserId is missing. Notification not created.');
    return;
  }
  try {
    const notificationData: Omit<Notification, 'id' | 'createdAt'> & { createdAt: any } = {
      userId: targetUserId,
      type,
      title,
      body,
      relatedItemId: relatedItemId || '',
      relatedItemType: relatedItemType || 'none',
      read: false,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'notifications'), notificationData);
  } catch (error) {
    console.error(`Error creating single notification for user ${targetUserId}:`, error);
  }
}

/**
 * Creates notifications for all users with a specific role.
 * Optionally excludes a user ID (e.g., the actor who triggered the event).
 */
export async function createNotificationsForRole(
  roleToNotify: UserRole,
  type: NotificationType,
  title: string,
  body: string,
  relatedItemId?: string,
  relatedItemType?: RelatedItemType,
  excludeUserId?: string
): Promise<void> {
  try {
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where('role', '==', roleToNotify));
    const querySnapshot = await getDocs(q);

    const notificationPromises: Promise<void>[] = [];
    querySnapshot.forEach((userDoc) => {
      if (userDoc.id !== excludeUserId) {
        notificationPromises.push(
          createSingleNotification(userDoc.id, type, title, body, relatedItemId, relatedItemType)
        );
      }
    });
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error(`Error creating notifications for role ${roleToNotify}:`, error);
  }
}

export { getUserDisplayName, getProjectName };


export interface MarkAllNotificationsAsReadResult {
  success: boolean;
  message: string;
  markedCount?: number;
  error?: string;
}

/**
 * Marks all unread notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<MarkAllNotificationsAsReadResult> {
  if (!userId) {
    return { success: false, message: 'User ID is required.' };
  }

  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: true, message: 'No unread notifications to mark.', markedCount: 0 };
    }

    const batch = writeBatch(db);
    querySnapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
    return { success: true, message: `Successfully marked ${querySnapshot.size} notification(s) as read.`, markedCount: querySnapshot.size };
  } catch (error) {
    console.error(`Error marking all notifications as read for user ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'Failed to mark notifications as read.', error: errorMessage };
  }
}
    
