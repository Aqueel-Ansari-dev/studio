
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

interface FormDataState {
  clientName: string;
  projectId: string;
  amount: number | ''; // Store amount as number or empty string for internal logic
  dueDate: string;
}

export default function SalesBillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormDataState>({
    clientName: '',
    projectId: '',
    amount: '', // Initialize as empty string for the input
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setFormData({ ...formData, amount: '' });
    } else {
      const parsedAmount = parseFloat(value);
      // Only update if it's a valid number or can become one (e.g. "1.")
      // We store the parsed number if valid, otherwise keep the string if it's just a partial input like "-" or "."
      setFormData({ ...formData, amount: isNaN(parsedAmount) && value !== '' && !value.endsWith('.') && value !== '-' ? formData.amount : parsedAmount });
    }
  };

  const getDisplayAmount = () => {
    // This ensures the input field always gets a string, even if internal state is number
    if (formData.amount === '' || typeof formData.amount === 'string') {
        return formData.amount; // if it's already an empty string or a string like "1."
    }
    return String(formData.amount);
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    
    const finalAmount = typeof formData.amount === 'number' ? formData.amount : parseFloat(String(formData.amount));
    if (isNaN(finalAmount) || finalAmount <= 0) {
        toast({ title: 'Validation Error', description: 'Amount must be a positive number.', variant: 'destructive' });
        return;
    }

    setSubmitting(true);
    const result = await createInvoice(user.id, {
        ...formData,
        amount: finalAmount,
    });
    if (result.success) {
      toast({ title: 'Invoice Created', description: `Invoice ID: ${result.invoiceId}` });
      setFormData({ clientName: '', projectId: '', amount: '', dueDate: format(new Date(), 'yyyy-MM-dd') });
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
              <Label htmlFor="amount">Amount (INR)</Label>
              <Input 
                type="number" 
                id="amount" 
                value={getDisplayAmount()} // Use getter for display
                onChange={handleAmountChange} // Use custom handler
                placeholder="0.00"
              />
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
