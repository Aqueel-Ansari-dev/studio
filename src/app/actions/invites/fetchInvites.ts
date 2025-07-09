
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { getOrganizationId } from '../common/getOrganizationId';
import type { Invite, UserRole } from '@/types/database';

export interface InviteForList extends Omit<Invite, 'createdAt' | 'expiresAt'> {
    createdAt: string;
    expiresAt: string;
}

export interface FetchInvitesResult {
    success: boolean;
    invites?: InviteForList[];
    error?: string;
}

export async function fetchInvitesForAdmin(adminId: string): Promise<FetchInvitesResult> {
    const organizationId = await getOrganizationId(adminId);
    if (!organizationId) {
        return { success: false, error: 'Could not determine organization for the admin.' };
    }

    try {
        const invitesRef = collection(db, 'invites');
        const q = query(
            invitesRef,
            where('organizationId', '==', organizationId),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const invites = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                expiresAt: (data.expiresAt as Timestamp).toDate().toISOString(),
            } as InviteForList;
        });

        return { success: true, invites };
    } catch (error) {
        console.error('Error fetching invites for admin:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        if (errorMessage.includes('firestore/failed-precondition')) {
            return { success: false, error: `Query requires a Firestore index. Please check server logs for details. Error: ${errorMessage}` };
        }
        return { success: false, error: `Failed to fetch invites: ${errorMessage}` };
    }
}
