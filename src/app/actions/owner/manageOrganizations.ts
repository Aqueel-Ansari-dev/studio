'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Organization } from '@/types/database';

export interface OrganizationForOwnerList {
  id: string;
  name: string;
  ownerId: string;
  adminEmail: string;
  planId?: Organization['planId'];
  billingCycle?: Organization['billingCycle'];
  subscriptionStatus?: Organization['subscriptionStatus'];
  createdAt: string;
}

export interface FetchAllOrganizationsResult {
  success: boolean;
  organizations?: OrganizationForOwnerList[];
  error?: string;
}

export async function fetchAllOrganizations(): Promise<FetchAllOrganizationsResult> {
  try {
    const snapshot = await getDocs(collection(db, 'organizations'));
    const orgs: OrganizationForOwnerList[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      let adminEmail = '';
      if (data.ownerId) {
        try {
          const adminSnap = await getDoc(doc(db, 'users', data.ownerId));
          if (adminSnap.exists()) {
            adminEmail = adminSnap.data().email || '';
          }
        } catch (e) {
          console.error('Failed to fetch admin email for', docSnap.id, e);
        }
      }
      orgs.push({
        id: docSnap.id,
        name: data.name || 'N/A',
        ownerId: data.ownerId || '',
        adminEmail,
        planId: data.planId,
        billingCycle: data.billingCycle,
        subscriptionStatus: data.subscriptionStatus,
        createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
      });
    }

    return { success: true, organizations: orgs };
  } catch (error) {
    console.error('Error fetching organizations:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage };
  }
}

export interface UpdateOrganizationStatusResult {
  success: boolean;
  message: string;
}

export async function updateOrganizationStatus(orgId: string, status: 'active' | 'paused'): Promise<UpdateOrganizationStatusResult> {
  try {
    await updateDoc(doc(db, 'organizations', orgId), { subscriptionStatus: status });
    return { success: true, message: `Organization status set to ${status}.` };
  } catch (error) {
    console.error('Error updating organization status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: errorMessage };
  }
}


