import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InvoiceDetailClientView } from "@/components/invoicing/invoice-detail-client-view";
import { getSystemSettings } from "@/app/actions/admin/systemSettings";
import type { Invoice } from "@/types/database";


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
      invoiceDate: invoiceData.invoiceDate instanceof Timestamp ? invoiceData.invoiceDate.toDate().toISOString() : invoiceData.invoiceDate,
      dueDate: invoiceData.dueDate instanceof Timestamp ? invoiceData.dueDate.toDate().toISOString() : invoiceData.dueDate,
      sentAt: invoiceData.sentAt instanceof Timestamp ? invoiceData.sentAt.toDate().toISOString() : invoiceData.sentAt,
      updatedAt: invoiceData.updatedAt instanceof Timestamp ? invoiceData.updatedAt.toDate().toISOString() : invoiceData.updatedAt,
    } as Invoice;

    // Default to an empty string if projectId is missing
    const projectId = invoice.projectId || '';
    let projectName = projectId;

    if (projectId) {
      const projSnap = await getDoc(doc(db, "projects", projectId));
      if (projSnap.exists()) {
          projectName = (projSnap.data() as any).name || projectId;
      }
    }
    
    return { invoice, projectName };
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { invoice, projectName } = await getInvoiceData(params.id);
  const { settings: systemSettings } = await getSystemSettings();

  if (!invoice) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Invoice Not Found</h1>
        <p>The invoice with ID "{params.id}" could not be found. It may have been deleted.</p>
      </div>
    );
  }
  
  return <InvoiceDetailClientView invoice={invoice} projectName={projectName || "N/A"} systemSettings={systemSettings} />;
}
