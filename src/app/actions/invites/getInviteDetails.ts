
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Invite, Organization, UserRole } from '@/types/database';

export interface InviteDetails {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  organizationId: string;
  organizationName: string;
}

export interface GetInviteDetailsResult {
  success: boolean;
  details?: InviteDetails;
  error?: string;
}

export async function getInviteDetails(inviteId: string): Promise<GetInviteDetailsResult> {
    if (!inviteId) {
        return { success: false, error: "Invite ID is missing." };
    }
    
    const inviteRef = doc(db, 'invites', inviteId);
    
    try {
        const inviteSnap = await getDoc(inviteRef);

        if (!inviteSnap.exists()) {
            return { success: false, error: "This invite is invalid or has already been used." };
        }

        const inviteData = inviteSnap.data() as any;

        if (inviteData.status !== 'pending') {
            return { success: false, error: "This invite has already been accepted." };
        }

        const expiresAt = (inviteData.expiresAt as Timestamp).toDate();
        if (new Date() > expiresAt) {
            // Optional: could add logic here to delete the expired invite
            return { success: false, error: "This invite has expired." };
        }
        
        const orgRef = doc(db, 'organizations', inviteData.organizationId);
        const orgSnap = await getDoc(orgRef);
        
        if (!orgSnap.exists()) {
            return { success: false, error: "The organization associated with this invite no longer exists." };
        }
        
        const orgData = orgSnap.data() as Organization;

        return {
            success: true,
            details: {
                id: inviteSnap.id,
                email: inviteData.email,
                role: inviteData.role,
                displayName: inviteData.displayName,
                organizationId: inviteData.organizationId,
                organizationName: orgData.name,
            }
        };

    } catch (error) {
        console.error('Error fetching invite details:', error);
        return { success: false, error: "An unexpected error occurred while fetching invite details." };
    }
}
