
"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Invoice, SystemSettings } from "@/types/database";
import { sendInvoiceToClient } from "@/app/actions/admin/invoicing/sendInvoiceToClient";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { format, parseISO } from "date-fns";
import { RefreshCw, Send } from "lucide-react";

interface InvoiceDetailClientViewProps {
    invoice: Invoice;
    projectName: string;
    systemSettings: SystemSettings | null; 
}

export function InvoiceDetailClientView({ invoice, projectName, systemSettings }: InvoiceDetailClientViewProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clientPhoneNumber, setClientPhoneNumber] = useState('');

  async function handleSend() {
    if (!invoice) return;
    if (!clientPhoneNumber) {
        toast({ title: "Phone number required", description: "Please enter a valid WhatsApp number.", variant: "destructive" });
        return;
    }
    setIsSending(true);
    const res = await sendInvoiceToClient(invoice.id, clientPhoneNumber);
    if (res.success) {
      toast({ title: "Sent", description: res.message, variant: "default" });
      setIsDialogOpen(false);
      // NOTE: Page will need a refresh to see the status change.
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
    setIsSending(false);
  }
  
  const formatDateSafe = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'PPP');
    } catch (e) {
      return dateString;
    }
  }
  
  const formatCurrency = (amount: number | undefined) => {
      if (typeof amount !== 'number') return 'N/A';
      return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

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
            {systemSettings?.companyLogoUrl && (
              <Image
                src={systemSettings.companyLogoUrl}
                alt={systemSettings.companyName || 'Company Logo'}
                width={100} 
                height={50} 
                className="object-contain mb-2"
                data-ai-hint="company logo"
              />
            )}
            {systemSettings?.companyName || "Your Company Name"} <br/>
            {invoice.invoiceNumber} - {invoice.status === 'draft' ? 'Draft' : 'Final'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 mb-4">
            <p>Project: {projectName}</p>
            <p>Client: {invoice.clientName}</p>
            <p>Invoice Date: {formatDateSafe(invoice.invoiceDate)}</p>
            <p>Due Date: {formatDateSafe(invoice.dueDate)}</p>
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Description</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-center">Unit Price</th>
                  <th className="p-2 text-center">Tax %</th>
                  <th className="p-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((i, idx) => (
                  <tr key={idx} className="border-b last:border-none">
                    <td className="p-2 text-left">{i.description}</td>
                    <td className="p-2 text-center">{i.quantity}</td>
                    <td className="p-2 text-center">{formatCurrency(i.unitPrice)}</td>
                    <td className="p-2 text-center">{i.taxRate}</td>
                    <td className="p-2 text-right">
                      {formatCurrency(i.quantity * i.unitPrice * (1 + i.taxRate / 100))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-right space-y-1">
            <p>Subtotal: {formatCurrency(invoice.subtotal)}</p>
            <p>Tax: {formatCurrency(invoice.taxTotal)}</p>
            <p className="font-semibold">Total: {formatCurrency(invoice.total)}</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Send className="mr-2 h-4 w-4" />
                Send to Client via WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Invoice to Client</DialogTitle>
                <DialogDescription>
                  Enter the client's WhatsApp number, including the country code (e.g., +15551234567).
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="whatsapp-number">Client's WhatsApp Number</Label>
                <Input
                  id="whatsapp-number"
                  value={clientPhoneNumber}
                  onChange={(e) => setClientPhoneNumber(e.target.value)}
                  placeholder="+15551234567"
                  disabled={isSending}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isSending}>Cancel</Button>
                </DialogClose>
                <Button onClick={handleSend} disabled={isSending}>
                  {isSending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                  {isSending ? "Sending..." : "Send Invoice"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </CardContent>
      </Card>
    </div>
  );
}
