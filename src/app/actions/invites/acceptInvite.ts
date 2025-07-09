
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';
import admin from 'firebase-admin';

const AcceptInviteSchema = z.object({
  inviteId: z.string().min(1),
  displayName: z.string().min(2),
  password: z.string().min(6),
});

export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;

export interface AcceptInviteResult {
  success: boolean;
  message: string;
  userId?: string;
  errors?: z.ZodIssue[];
}

export async function acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
    const validation = AcceptInviteSchema.safeParse(input);
    if (!validation.success) {
        return { success: false, message: "Invalid input.", errors: validation.error.issues };
    }
    
    const { inviteId, displayName, password } = validation.data;
    const inviteRef = doc(db, 'invites', inviteId);
    
    try {
        const inviteSnap = await getDoc(inviteRef);
        if (!inviteSnap.exists() || inviteSnap.data().status !== 'pending') {
            return { success: false, message: "This invite is invalid or has already been used." };
        }
        
        const inviteData = inviteSnap.data() as any;
        if (new Date() > (inviteData.expiresAt as Timestamp).toDate()) {
            return { success: false, message: "This invite has expired." };
        }

        const { email, role, organizationId } = inviteData;
        
        const adminApp = initializeAdminApp();
        const auth = admin.auth(adminApp);
        
        const userRecord = await auth.createUser({
            email,
            password,
            displayName,
            emailVerified: true,
        });

        const batch = writeBatch(db);

        const newUserProfile = {
            uid: userRecord.uid,
            displayName,
            email,
            role,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            organizationId,
        };

        // 1. Create the user document in the organization's subcollection
        const orgUserDocRef = doc(db, 'organizations', organizationId, 'users', userRecord.uid);
        batch.set(orgUserDocRef, newUserProfile);

        // 2. Create the global user-to-org mapping
        const userMappingDocRef = doc(db, 'users', userRecord.uid);
        batch.set(userMappingDocRef, {
            organizationId,
            role,
            displayName,
            email,
        });
        
        // 3. Update the invite status to 'accepted'
        batch.update(inviteRef, { status: 'accepted' });
        
        await batch.commit();

        return { success: true, message: "Account created successfully! You can now log in.", userId: userRecord.uid };
        
    } catch (error: any) {
        console.error('Error accepting invite:', error);
        let errorMessage = "An unexpected error occurred.";
        if (error.code === 'auth/email-already-exists') {
            errorMessage = "An account with this email already exists. Please log in instead.";
        } else if (error.message.includes('Firebase Admin SDK service account credentials are not set')) {
            errorMessage = "Configuration Error: Admin SDK credentials not set on the server.";
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { success: false, message: errorMessage };
    }
}
