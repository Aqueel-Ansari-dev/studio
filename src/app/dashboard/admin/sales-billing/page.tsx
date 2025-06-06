"use client";

import { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle } from "lucide-react";
import { format } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createInvoice, type CreateInvoiceInput } from '@/app/actions/admin/invoicing/createInvoice';

export default function SalesBillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<CreateInvoiceInput>({
    clientName: '',
    projectId: '',
    amount: 0,
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    setSubmitting(true);
    const result = await createInvoice(user.id, formData);
    if (result.success) {
      toast({ title: 'Invoice Created', description: `Invoice ID: ${result.invoiceId}` });
      setFormData({ clientName: '', projectId: '', amount: 0, dueDate: format(new Date(), 'yyyy-MM-dd') });
    } else {
      toast({ title: 'Creation Failed', description: result.message, variant: 'destructive' });
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sales & Billing" description="Create and manage client invoices." />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Create Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" value={formData.clientName} onChange={e => setFormData({ ...formData, clientName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="projectId">Project ID</Label>
              <Input id="projectId" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input type="number" id="amount" value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} />
            </div>
            <div className="flex flex-col">
              <Label>Due Date</Label>
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(formData.dueDate), 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <Calendar
                    mode="single"
                    selected={new Date(formData.dueDate)}
                    onSelect={(date) => {
                      if (date) setFormData({ ...formData, dueDate: format(date, 'yyyy-MM-dd') });
                      setShowDatePicker(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button type="submit" disabled={submitting} className="bg-accent hover:bg-accent/90">
              {submitting ? 'Creating...' : (<><PlusCircle className="mr-2 h-4 w-4" /> Create Invoice</>)}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
