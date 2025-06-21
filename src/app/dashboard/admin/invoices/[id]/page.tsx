
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchAllInvoiceIds } from "@/app/actions/admin/invoicing/fetchAllInvoiceIds";
import { InvoiceDetailClientView } from "@/components/invoicing/invoice-detail-client-view";
import type { Invoice } from "@/types/database";

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

    const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

    const projSnap = await getDoc(doc(db, "projects", invoice.projectId));
    const projectName = projSnap.exists() ? (projSnap.data() as any).name : invoice.projectId;
    
    return { invoice, projectName };
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { invoice, projectName } = await getInvoiceData(params.id);

  if (!invoice || !projectName) {
    return <div>Invoice not found.</div>;
  }
  
  return <InvoiceDetailClientView invoice={invoice} projectName={projectName} />;
}
