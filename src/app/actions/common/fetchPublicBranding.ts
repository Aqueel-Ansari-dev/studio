
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PublicBranding {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
}

export async function fetchPublicBranding(organizationId: string): Promise<{ success: boolean; branding?: PublicBranding; error?: string }> {
    if (!organizationId) {
        return { success: false, error: 'Organization ID is required.' };
    }

    try {
        const orgDocRef = doc(db, 'organizations', organizationId);
        const orgDocSnap = await getDoc(orgDocRef);

        if (!orgDocSnap.exists()) {
            return { success: false, error: 'Organization not found.' };
        }

        const orgData = orgDocSnap.data();
        
        // Fetch the specific branding settings from the subcollection
        const settingsDocRef = doc(db, 'organizations', organizationId, 'settings', 'companySettings');
        const settingsDocSnap = await getDoc(settingsDocRef);
        const settingsData = settingsDocSnap.exists() ? settingsDocSnap.data() : {};

        const branding: PublicBranding = {
            name: orgData.name || 'FieldOps',
            logoUrl: settingsData.companyLogoUrl || null,
            primaryColor: settingsData.primaryColor || null
        };
        
        return { success: true, branding };

    } catch (error) {
        console.error(`Error fetching public branding for org ${organizationId}:`, error);
        return { success: false, error: 'Failed to fetch branding information.' };
    }
}
