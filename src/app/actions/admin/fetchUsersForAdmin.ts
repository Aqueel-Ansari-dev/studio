
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp, limit as firestoreLimit, startAfter, doc, getDoc, where, QueryConstraint } from 'firebase/firestore';
import { collection, getDocs, orderBy, query, Timestamp, limit, startAfter, doc, getDoc, where, QueryConstraint } from 'firebase/firestore';
import { verifyRole } from '../common/verifyRole';
import type { UserRole, PayMode } from '@/types/database';

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
  error?: string;
}

export interface FetchUsersForAdminFilters {
  role?: UserRole | 'all';
  status?: 'active' | 'inactive' | 'all';
  searchTerm?: string | null;
}

export async function fetchUsersForAdmin(
  page: number,
  pageSize: number,
  adminUserId: string,
  limitNumber: number = USERS_PER_PAGE,
  startAfterValue?: string | null,
  filters: FetchUsersForAdminFilters = { role: 'all', status: 'all', searchTerm: null }
): Promise<FetchUsersForAdminResult> {
  const isAdmin = await verifyRole(adminUserId, ['admin']);
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: admin access required.' };
  }

  try {
    const usersCollectionRef = collection(db, 'users');
    const queryConstraints: QueryConstraint[] = [];
    const { role, status, searchTerm } = filters;
    
    // Apply filters
    if (role && role !== 'all') {
      queryConstraints.push(where('role', '==', role));
    }
    if (status && status !== 'all') {
      queryConstraints.push(where('isActive', '==', status === 'active'));
    }

    let orderByField: 'displayName' | 'createdAt' = 'displayName';
    let orderDirection: 'asc' | 'desc' = 'asc';

    if (searchTerm && searchTerm.trim() !== '') {
      orderByField = 'displayName';
      orderDirection = 'asc';
      queryConstraints.push(where(orderByField, '>=', searchTerm.trim()));
      queryConstraints.push(where(orderByField, '<=', searchTerm.trim() + '\uf8ff'));
    } else {
        orderByField = 'createdAt';
        orderDirection = 'desc';
    }

    queryConstraints.push(orderBy(orderByField, orderDirection));

    // Pagination logic
    let q = query(usersCollectionRef, ...queryConstraints);

    if (page > 1) {
      const offset = (page - 1) * pageSize;
      const previousPageQuery = query(usersCollectionRef, ...queryConstraints, firestoreLimit(offset));
      const previousPageSnapshot = await getDocs(previousPageQuery);
      
      if (previousPageSnapshot.docs.length > 0) {
        const lastVisible = previousPageSnapshot.docs[previousPageSnapshot.docs.length - 1];
        queryConstraints.push(startAfter(lastVisible));
      } else {
        // Page is out of bounds
        return { success: true, users: [] };
      }
    }
    
    const finalQuery = query(usersCollectionRef, ...queryConstraints, firestoreLimit(pageSize));
    const querySnapshot = await getDocs(finalQuery);

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

    return { success: true, users: fetchedUsers };
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index. Please check server logs for details. Error: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch users: ${errorMessage}` };
  }
}
