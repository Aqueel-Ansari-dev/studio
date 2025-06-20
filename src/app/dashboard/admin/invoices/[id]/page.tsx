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
  useEffect(() => {
    async function load() {
      if (!params?.id) return;
      const snap = await getDoc(doc(db, "invoices", params.id as string));
      if (snap.exists()) setInvoice({ id: snap.id, ...(snap.data() as any) });
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
          <CardTitle>{invoice.status === "draft" ? "Draft" : "Final"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Project: {invoice.projectId}</p>
          <p>Client: {invoice.clientId}</p>
          <p>Total: {invoice.total}</p>
          {invoice.status === "draft" && (
            <Button onClick={handleSend}>Send to Client</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
