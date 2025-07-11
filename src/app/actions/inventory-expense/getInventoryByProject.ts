
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { InventoryItem } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

export interface InventoryItemWithTotalCost extends InventoryItem {
  totalItemCost: number;
  createdAt: string; // Ensure createdAt is string
}

export interface ProjectInventoryDetails {
  items: InventoryItemWithTotalCost[];
  totalInventoryCost: number;
}

export async function getInventoryByProject(projectId: string, requestingUserId: string): Promise<ProjectInventoryDetails | { error: string }> {
  const organizationId = await getOrganizationId(requestingUserId);
  if (!organizationId) {
    return { error: 'User or organization not found.' };
  }
  if (!projectId) {
    return { error: 'Project ID is required.' };
  }

  try {
    const inventoryCollectionRef = collection(db, 'organizations', organizationId, 'projectInventory');
    const q = query(inventoryCollectionRef, where('projectId', '==', projectId));
    const querySnapshot = await getDocs(q);

    let totalInventoryCost = 0;
    const items: InventoryItemWithTotalCost[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as Omit<InventoryItem, 'id' | 'createdAt'> & { createdAt: Timestamp };
      const totalItemCost = (data.quantity || 0) * (data.costPerUnit || 0);
      totalInventoryCost += totalItemCost;
      
      const createdAt = data.createdAt instanceof Timestamp 
                        ? data.createdAt.toDate().toISOString()
                        : (typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString());

      return {
        id: docSnap.id,
        ...data,
        createdAt,
        totalItemCost: parseFloat(totalItemCost.toFixed(2)),
      };
    });

    return {
      items,
      totalInventoryCost: parseFloat(totalInventoryCost.toFixed(2)),
    };
  } catch (error) {
    console.error(`Error fetching inventory for project ${projectId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { error: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { error: `Failed to fetch inventory: ${errorMessage}` };
  }
}
