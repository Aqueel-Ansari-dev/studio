
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp, limit, startAfter, doc, getDoc } from 'firebase/firestore';
import type { UserRole, PayMode } from '@/types/database';

const PAGE_LIMIT = 15;

export interface UserForAdminList {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  createdAt: string; // ISO string
  payMode?: PayMode;
  rate?: number;
  assignedProjectIds?: string[];
}

export interface FetchUsersForAdminResult {
  success: boolean;
  users?: UserForAdminList[];
  lastVisibleCreatedAtISO?: string | null;
  hasMore?: boolean;
  error?: string;
}

export async function fetchUsersForAdmin(
  limitNumber: number = PAGE_LIMIT,
  startAfterCreatedAtISO?: string | null
): Promise<FetchUsersForAdminResult> {
  // TODO: Add robust admin role verification here in a production app

  try {
    const usersCollectionRef = collection(db, 'users');
    let q = query(usersCollectionRef, orderBy('createdAt', 'desc'));

    if (startAfterCreatedAtISO) {
      const startAfterTimestamp = Timestamp.fromDate(new Date(startAfterCreatedAtISO));
      q = query(q, startAfter(startAfterTimestamp));
    }

    q = query(q, limit(limitNumber + 1)); // Fetch one extra to check if there's more
    
    const querySnapshot = await getDocs(q);

    const fetchedUsers = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const displayName = data.displayName || data.email?.split('@')[0] || 'N/A';
      const createdAt = data.createdAt instanceof Timestamp 
                          ? data.createdAt.toDate().toISOString() 
                          : (typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString());

      return {
        id: docSnap.id,
        displayName: displayName,
        email: data.email || 'N/A',
        role: data.role || 'employee', 
        avatarUrl: data.photoURL || data.avatarUrl || `https://placehold.co/40x40.png?text=${displayName.substring(0,2).toUpperCase()}`,
        createdAt: createdAt,
        payMode: data.payMode || 'not_set',
        rate: typeof data.rate === 'number' ? data.rate : 0,
        assignedProjectIds: data.assignedProjectIds || [],
      };
    });

    const hasMore = fetchedUsers.length > limitNumber;
    const usersToReturn = hasMore ? fetchedUsers.slice(0, limitNumber) : fetchedUsers;
    const lastVisibleDoc = usersToReturn.length > 0 ? usersToReturn[usersToReturn.length - 1] : null;
    const lastVisibleCreatedAtISO = lastVisibleDoc ? lastVisibleDoc.createdAt : null;

    return { success: true, users: usersToReturn, lastVisibleCreatedAtISO, hasMore };
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch users: ${errorMessage}` };
  }
}
