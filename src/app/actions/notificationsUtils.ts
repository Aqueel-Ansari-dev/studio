
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
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

    