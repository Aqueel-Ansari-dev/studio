
'use server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * A reusable server-side utility to get the organization ID for a given user.
 * This helps to keep other server actions DRY (Don't Repeat Yourself).
 * @param userId - The UID of the user.
 * @returns The organization ID string, or null if not found or an error occurs.
 */
export async function getOrganizationId(userId: string): Promise<string | null> {
    if (!userId) {
        console.error('[getOrganizationId] No user ID provided.');
        return null;
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const organizationId = userDocSnap.data()?.organizationId;
            if (organizationId) {
                return organizationId;
            } else {
                console.warn(`[getOrganizationId] User ${userId} does not have an organizationId field.`);
                return null;
            }
        } else {
            console.warn(`[getOrganizationId] User document for ${userId} not found.`);
            return null;
        }
    } catch (error) {
        console.error(`[getOrganizationId] Error fetching organization ID for user ${userId}:`, error);
        return null;
    }
}

    