
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, Timestamp, where, QueryConstraint } from 'firebase/firestore';
import type { DPR } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

export interface DPRForList extends DPR {
    createdAt: string;
    reportDate: string;
}

export interface FetchDprsFilters {
    projectId?: string;
    supervisorId?: string;
    startDate?: Date;
    endDate?: Date;
}

const FetchFiltersSchema = z.object({
  projectId: z.string().optional(),
  supervisorId: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});


export interface FetchDprsResult {
    success: boolean;
    dprs?: DPRForList[];
    error?: string;
}

export async function fetchDprsForAdmin(adminId: string, filters?: FetchDprsFilters): Promise<FetchDprsResult> {
    const organizationId = await getOrganizationId(adminId);
    if (!organizationId) {
        return { success: false, error: "Could not determine organization." };
    }

    const validation = FetchFiltersSchema.safeParse(filters || {});
    if (!validation.success) {
      return { success: false, error: 'Invalid filter data.' };
    }
    const { projectId, supervisorId, startDate, endDate } = validation.data;

    try {
        const dprCollectionRef = collection(db, 'organizations', organizationId, 'dprs');
        const queryConstraints: QueryConstraint[] = [orderBy('reportDate', 'desc')];
        
        if (projectId) {
            queryConstraints.push(where('projectId', '==', projectId));
        }
        if (supervisorId) {
            queryConstraints.push(where('supervisorId', '==', supervisorId));
        }
        if (startDate) {
            queryConstraints.push(where('reportDate', '>=', Timestamp.fromDate(startDate)));
        }
        if (endDate) {
            queryConstraints.push(where('reportDate', '<=', Timestamp.fromDate(endDate)));
        }

        const q = query(dprCollectionRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);

        const dprs = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                reportDate: (data.reportDate as Timestamp).toDate().toISOString(),
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            } as DPRForList;
        });

        return { success: true, dprs };

    } catch (error) {
        console.error("Error fetching DPRs for admin:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        if (errorMessage.includes('firestore/failed-precondition')) {
            return { success: false, error: `Query requires a Firestore index. Please check the console for a link to create it. Details: ${errorMessage}`};
        }
        return { success: false, error: `Failed to fetch DPRs: ${errorMessage}` };
    }
}
