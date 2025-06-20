"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Invoice } from "@/types/database";
import { sendInvoiceToClient } from "@/app/actions/admin/invoicing/sendInvoiceToClient";
import { useToast } from "@/hooks/use-toast";

export default function InvoiceDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [projectName, setProjectName] = useState("-");
  const [clientName, setClientName] = useState("-");
  useEffect(() => {
    async function load() {
      if (!params?.id) return;
      const snap = await getDoc(doc(db, "invoices", params.id as string));
      if (snap.exists()) {
        const inv = { id: snap.id, ...(snap.data() as any) } as Invoice;
        setInvoice(inv);
        const projSnap = await getDoc(doc(db, "projects", inv.projectId));
        setProjectName(projSnap.exists() ? (projSnap.data() as any).name : inv.projectId);
        setClientName(inv.clientName);
      }
    }
    load();
  }, [params]);

  async function handleSend() {
    if (!invoice) return;
    const res = await sendInvoiceToClient(invoice.id);
    toast({ title: res.success ? "Sent" : "Error", description: res.message, variant: res.success ? "default" : "destructive" });
  }

  if (!invoice) return null;
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description="Invoice details"
        actions={
          <Button asChild variant="outline">
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
              Download PDF
            </a>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>
            {invoice.invoiceNumber} - {invoice.status === 'draft' ? 'Draft' : 'Final'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 mb-4">
            <p>Project: {projectName}</p>
            <p>Client: {clientName}</p>
            <p>Invoice Date: {invoice.invoiceDate}</p>
            <p>Due Date: {invoice.dueDate}</p>
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Description</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Unit Price</th>
                  <th className="p-2">Tax %</th>
                  <th className="p-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((i, idx) => (
                  <tr key={idx} className="border-b last:border-none">
                    <td className="p-2 text-left">{i.description}</td>
                    <td className="p-2 text-center">{i.quantity}</td>
                    <td className="p-2 text-center">{i.unitPrice.toFixed(2)}</td>
                    <td className="p-2 text-center">{i.taxRate}</td>
                    <td className="p-2 text-right">
                      {(i.quantity * i.unitPrice * (1 + i.taxRate / 100)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-right space-y-1">
            <p>Subtotal: {invoice.subtotal.toFixed(2)}</p>
            <p>Tax: {invoice.taxTotal.toFixed(2)}</p>
            <p className="font-semibold">Total: {invoice.total.toFixed(2)}</p>
          </div>
          {invoice.status === 'draft' && (
            <Button className="mt-4" onClick={handleSend}>
              Send to Client
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
