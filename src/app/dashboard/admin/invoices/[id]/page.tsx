
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InvoiceDetailClientView } from "@/components/invoicing/invoice-detail-client-view";
import { getSystemSettings } from "@/app/actions/admin/systemSettings";
import type { Invoice } from "@/types/database";
import { getOrganizationId } from "@/app/actions/common/getOrganizationId";
import { headers } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { initializeAdminApp } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

async function getUserId() {
    try {
        const idToken = headers().get('Authorization')?.split('Bearer ')[1];
        if (!idToken) return null;
        const decodedToken = await getAuth(initializeAdminApp()).verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return null;
    }
}

async function getInvoiceData(adminId: string, id: string) {
    const organizationId = await getOrganizationId(adminId);
    if (!organizationId) {
        return { invoice: null, projectName: null, error: "Could not determine organization." };
    }

    const invoiceSnap = await getDoc(doc(db, "organizations", organizationId, "invoices", id));
    if (!invoiceSnap.exists()) {
        return { invoice: null, projectName: null, error: `Invoice with ID ${id} not found in organization ${organizationId}` };
    }

    const invoiceData = invoiceSnap.data() as Invoice;

    const invoice = {
      id: invoiceSnap.id,
      ...invoiceData,
      createdAt: invoiceData.createdAt instanceof Timestamp ? invoiceData.createdAt.toDate().toISOString() : invoiceData.createdAt, 
      invoiceDate: invoiceData.invoiceDate instanceof Timestamp ? invoiceData.invoiceDate.toDate().toISOString() : invoiceData.invoiceDate,
      dueDate: invoiceData.dueDate instanceof Timestamp ? invoiceData.dueDate.toDate().toISOString() : invoiceData.dueDate,
      sentAt: invoiceData.sentAt instanceof Timestamp ? invoiceData.sentAt.toDate().toISOString() : invoiceData.sentAt,
      updatedAt: invoiceData.updatedAt instanceof Timestamp ? invoiceData.updatedAt.toDate().toISOString() : invoiceData.updatedAt,
    } as Invoice;

    const projectId = invoice.projectId || '';
    let projectName = projectId;

    if (projectId) {
      const projSnap = await getDoc(doc(db, "organizations", organizationId, "projects", projectId));
      if (projSnap.exists()) {
          projectName = (projSnap.data() as any).name || projectId;
      }
    }
    
    return { invoice, projectName, error: null };
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const adminId = await getUserId();
  
  if (!adminId) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-bold">Authentication Error</h1>
          <p>You must be logged in to view this page.</p>
        </div>
      );
  }

  const { invoice, projectName, error } = await getInvoiceData(adminId, params.id);
  const { settings: systemSettings } = await getSystemSettings(adminId);

  if (error || !invoice) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Invoice Not Found</h1>
        <p>{error || `The invoice with ID "${params.id}" could not be found.`}</p>
      </div>
    );
  }
  
  return <InvoiceDetailClientView invoice={invoice} projectName={projectName || "N/A"} systemSettings={systemSettings} />;
}
