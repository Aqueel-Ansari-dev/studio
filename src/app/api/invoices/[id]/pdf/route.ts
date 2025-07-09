
import { NextRequest } from 'next/server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { getSystemSettings } from '@/app/actions/admin/systemSettings';
import { getOrganizationId } from '@/app/actions/common/getOrganizationId';
import { headers } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase-admin';


async function getRequestingUser() {
    try {
        const idToken = headers().get('Authorization')?.split('Bearer ')[1];
        if (!idToken) return { error: 'No auth token found.', uid: null, orgId: null };
        
        const decodedToken = await getAuth(initializeAdminApp()).verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const orgId = await getOrganizationId(uid);

        if (!orgId) return { error: 'Could not determine organization.', uid, orgId: null };

        return { error: null, uid, orgId };
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return { error: 'Invalid auth token.', uid: null, orgId: null };
    }
}

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  const { id } = await context.params;
  
  const { error, uid, orgId } = await getRequestingUser();
  if (error || !uid || !orgId) {
    return new Response(error || "Authentication failed", { status: 401 });
  }

  try {
    const { settings } = await getSystemSettings(uid);
    const pdf = await generateInvoicePdf(orgId, id, settings);
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      },
    });
  } catch(error) {
    console.error(`Failed to generate PDF for invoice ${id}:`, error);
    return new Response('Invoice not found or failed to generate PDF.', { status: 404 });
  }
}
