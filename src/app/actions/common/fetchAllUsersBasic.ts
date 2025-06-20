'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export interface UserBasic {
  id: string;
  name: string;
}

export interface FetchAllUsersBasicResult {
  success: boolean;
  users?: UserBasic[];
  error?: string;
}

export async function fetchAllUsersBasic(): Promise<FetchAllUsersBasicResult> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('displayName', 'asc'));
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.displayName || data.email || 'Unnamed',
      } as UserBasic;
    });
    return { success: true, users };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('fetchAllUsersBasic error', err);
    return { success: false, error: msg };
  }
}
