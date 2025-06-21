import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchAllInvoiceIds } from "@/app/actions/admin/invoicing/fetchAllInvoiceIds";
import { InvoiceDetailClientView } from "@/components/invoicing/invoice-detail-client-view";
import { getSystemSettings } from "@/app/actions/admin/systemSettings";
import type { Invoice, SystemSettings } from "@/types/database";

export async function generateStaticParams() {
  const invoiceIds = await fetchAllInvoiceIds();
  return invoiceIds.map((invoice) => ({
    id: invoice.id,
  }));
}

async function getInvoiceData(id: string) {
    const invoiceSnap = await getDoc(doc(db, "invoices", id));
    if (!invoiceSnap.exists()) {
        return { invoice: null, projectName: null };
    }

    const invoiceData = invoiceSnap.data() as Invoice;

    // Convert Firestore Timestamps to ISO strings for client component compatibility
    const invoice = {
      id: invoiceSnap.id,
      ...invoiceData,
      createdAt: invoiceData.createdAt instanceof Timestamp ? invoiceData.createdAt.toDate().toISOString() : invoiceData.createdAt, 
      // Assuming invoiceDate and dueDate are already strings or can be handled as such
    } as Invoice;

    const projSnap = await getDoc(doc(db, "projects", invoice.projectId));
    const projectName = projSnap.exists() ? (projSnap.data() as any).name : invoice.projectId;
    
    return { invoice, projectName };
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { invoice, projectName } = await getInvoiceData(params.id);
  const { settings: systemSettings } = await getSystemSettings();

  if (!invoice || !projectName) {
    return <div>Invoice not found.</div>;
  }
  
  return <InvoiceDetailClientView invoice={invoice} projectName={projectName} systemSettings={systemSettings} />;
}
