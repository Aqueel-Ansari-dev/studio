
'use server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, doc, getDoc } from 'firebase/firestore';
import { getOrganizationId } from '../common/getOrganizationId';
import type { UserRole, Organization } from '@/types/database';
import { getPlanById } from '@/app/actions/owner/managePlans';
import { countUsers } from './countUsers';

// Schema for the invite form
const SendInviteSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  role: z.enum(['employee', 'supervisor', 'admin'], { message: "A role must be selected." }),
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }).optional(),
});

export type SendInviteInput = z.infer<typeof SendInviteSchema>;

export interface SendInviteResult {
  success: boolean;
  message: string;
  inviteId?: string;
  inviteLink?: string;
  errors?: z.ZodIssue[];
}

export async function sendInvite(adminId: string, input: SendInviteInput): Promise<SendInviteResult> {
    const organizationId = await getOrganizationId(adminId);
    if (!organizationId) {
        return { success: false, message: "Could not determine organization for the admin." };
    }

    const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminId));
    if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
      return { success: false, message: "Unauthorized action. Admin role required." };
    }
    
    // Check plan limits before sending invite
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    if (!orgDoc.exists()) {
        return { success: false, message: "Organization data not found." };
    }
    const orgData = orgDoc.data() as Organization;
    const plan = await getPlanById(orgData.planId);

    if (plan && plan.userLimit > 0) {
        const userCountResult = await countUsers(adminId, organizationId, {});
        if (userCountResult.success && typeof userCountResult.count === 'number' && userCountResult.count >= plan.userLimit) {
            return {
                success: false,
                message: `User limit of ${plan.userLimit} for the ${plan.name} plan has been reached. Please upgrade your plan to add more users.`
            };
        }
    }

    const validation = SendInviteSchema.safeParse(input);
    if (!validation.success) {
        return { success: false, message: "Invalid input.", errors: validation.error.issues };
    }
    
    const { email, role, displayName } = validation.data;
    
    try {
        // Use a top-level invites collection for easier lookup by ID
        const invitesCollectionRef = collection(db, 'invites');
        
        // Expiry date (e.g., 48 hours from now)
        const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);

        const inviteData = {
            organizationId,
            email,
            role,
            displayName: displayName || '',
            inviterId: adminId,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
            expiresAt,
        };

        const docRef = await addDoc(invitesCollectionRef, inviteData);
        
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join?inviteId=${docRef.id}`;
        
        console.log(`[Invite Sent] To: ${email}, Link: ${inviteLink}`);

        return { 
            success: true, 
            message: `Invite sent successfully to ${email}.`,
            inviteId: docRef.id,
            inviteLink
        };
    } catch (error) {
        console.error('Error sending invite:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: `Failed to send invite: ${errorMessage}` };
    }
}
