
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp, limit, startAfter, doc, getDoc, where, QueryConstraint } from 'firebase/firestore';
import type { UserRole, PayMode } from '@/types/database';

const USERS_PER_PAGE = 10;

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
  isActive?: boolean;
}

export interface FetchUsersForAdminResult {
  success: boolean;
  users?: UserForAdminList[];
  lastVisibleValue?: string | null; // Can be ISO date string or displayName string
  cursorField?: 'createdAt' | 'displayName'; // Indicates what lastVisibleValue refers to
  hasMore?: boolean;
  error?: string;
}

export async function fetchUsersForAdmin(
  limitNumber: number = USERS_PER_PAGE,
  startAfterValue?: string | null,
  searchTerm?: string | null
): Promise<FetchUsersForAdminResult> {
  // TODO: Add robust admin role verification here in a production app

  try {
    const usersCollectionRef = collection(db, 'users');
    const queryConstraints: QueryConstraint[] = [];

    let cursorField: 'createdAt' | 'displayName' = 'createdAt';

    if (searchTerm && searchTerm.trim() !== '') {
      cursorField = 'displayName';
      queryConstraints.push(orderBy('displayName', 'asc'));
      queryConstraints.push(where('displayName', '>=', searchTerm.trim()));
      queryConstraints.push(where('displayName', '<=', searchTerm.trim() + '\uf8ff'));
      if (startAfterValue) {
        // For displayName pagination, startAfterValue is the name string itself
        queryConstraints.push(startAfter(startAfterValue));
      }
    } else {
      cursorField = 'createdAt';
      queryConstraints.push(orderBy('createdAt', 'desc'));
      if (startAfterValue) {
        try {
            const startAfterTimestamp = Timestamp.fromDate(new Date(startAfterValue));
            queryConstraints.push(startAfter(startAfterTimestamp));
        } catch (dateParseError) {
            console.error("Error parsing startAfterValue as date for createdAt pagination:", dateParseError);
            // Potentially return an error or don't apply startAfter if parsing fails
        }
      }
    }
    
    queryConstraints.push(limit(limitNumber + 1)); // Fetch one extra to check if there's more
    
    const q = query(usersCollectionRef, ...queryConstraints);
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
        isActive: data.isActive === undefined ? true : data.isActive,
      };
    });

    const hasMore = fetchedUsers.length > limitNumber;
    const usersToReturn = hasMore ? fetchedUsers.slice(0, limitNumber) : fetchedUsers;
    
    let lastVisibleValueToReturn: string | null = null;
    if (usersToReturn.length > 0) {
        const lastDocData = usersToReturn[usersToReturn.length - 1];
        if (lastDocData) {
            if (cursorField === 'displayName') {
                lastVisibleValueToReturn = lastDocData.displayName;
            } else { // createdAt
                lastVisibleValueToReturn = lastDocData.createdAt;
            }
        }
    }

    return { 
        success: true, 
        users: usersToReturn, 
        lastVisibleValue: lastVisibleValueToReturn, 
        cursorField,
        hasMore 
    };
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index. Please check server logs for details. Error: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch users: ${errorMessage}` };
  }
}
