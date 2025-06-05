
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, RefreshCw, Landmark, DollarSign, Tag, FileText, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { logEmployeeExpense, LogExpenseInput, LogExpenseResult } from '@/app/actions/inventory-expense/logEmployeeExpense';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';

type ExpenseType = 'travel' | 'food' | 'tools' | 'other';
const expenseTypeOptions: ExpenseType[] = ['travel', 'food', 'tools', 'other'];

export default function LogExpensePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [expenseType, setExpenseType] = useState<ExpenseType>('other');
  const [amount, setAmount] = useState<number | string>('');
  const [notes, setNotes] = useState('');
  const [receiptImageUri, setReceiptImageUri] = useState(''); // For MVP, direct URL input

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  const loadProjectsList = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const fetchedProjects = await fetchAllProjects();
      setProjects(fetchedProjects);
    } catch (error) {
      console.error("Error loading projects:", error);
      toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
    } finally {
      setLoadingProjects(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProjectsList();
  }, [loadProjectsList]);

  const resetForm = () => {
    setSelectedProjectId('');
    setExpenseType('other');
    setAmount('');
    setNotes('');
    setReceiptImageUri('');
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!user || (!user.id && !authLoading)) {
      toast({ title: "Authentication Error", description: "User not authenticated. Please log in.", variant: "destructive" });
      return;
    }
     if (!user.id && authLoading) {
        toast({ title: "Authenticating", description: "Please wait, user session is loading.", variant: "default" });
        return;
    }
     if (!user.id) { // Should not happen if authLoading is false and user is still null
        toast({ title: "Authentication Error", description: "User ID missing after auth check.", variant: "destructive" });
        return;
    }

    const parsedAmount = parseFloat(String(amount));

    let currentErrors: Record<string, string | undefined> = {};
    if (!selectedProjectId) currentErrors.projectId = "Project is required.";
    if (isNaN(parsedAmount) || parsedAmount <= 0) currentErrors.amount = "Amount must be a positive number.";
    if (receiptImageUri && !receiptImageUri.startsWith('http')) currentErrors.receiptImageUri = "Please enter a valid URL for the receipt image.";


    if (Object.keys(currentErrors).length > 0) {
        setFormErrors(currentErrors);
        toast({ title: "Validation Error", description: "Please check the form for errors.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);

    const expenseInput: LogExpenseInput = {
      projectId: selectedProjectId,
      type: expenseType,
      amount: parsedAmount,
      notes: notes || undefined,
      receiptImageUri: receiptImageUri || undefined,
    };

    const result: LogExpenseResult = await logEmployeeExpense(user.id, expenseInput);

    if (result.success) {
      toast({
        title: "Expense Logged!",
        description: `Expense of ${parsedAmount} for ${expenseType} logged successfully. Expense ID: ${result.expenseId}`,
      });
      resetForm();
    } else {
      if (result.errors) {
        const newErrors: Record<string, string | undefined> = {};
        result.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
        setFormErrors(newErrors);
      }
      toast({
        title: "Failed to Log Expense",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };
  
  if (authLoading) {
    return <div className="p-4">Loading user...</div>;
  }

  if (!user) { // Should ideally be handled by AuthProvider redirect, but as a fallback
    return (
      <div className="p-4">
        <PageHeader title="Access Denied" description="Please log in to log expenses." />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader title="Log Employee Expense" description="Submit your field expenses for reimbursement or tracking." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center"><DollarSign className="mr-2 h-6 w-6 text-primary" />Expense Details</CardTitle>
          <CardDescription>Fill in the details of your expense.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="project">Project <span className="text-destructive">*</span></Label>
                    <div className="relative">
                        <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Select 
                            value={selectedProjectId} 
                            onValueChange={setSelectedProjectId} 
                            disabled={loadingProjects || projects.length === 0}
                        >
                            <SelectTrigger id="project" className="pl-10">
                            <SelectValue placeholder={loadingProjects ? "Loading projects..." : (projects.length === 0 ? "No projects available" : "Select a project")} />
                            </SelectTrigger>
                            <SelectContent>
                            {loadingProjects ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : projects.length > 0 ? (
                                projects.map(proj => (
                                <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                                ))
                            ) : (
                                <SelectItem value="no-projects" disabled>No projects found.</SelectItem>
                            )}
                            </SelectContent>
                        </Select>
                    </div>
                    {formErrors.projectId && <p className="text-sm text-destructive mt-1">{formErrors.projectId}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="expenseType">Expense Type <span className="text-destructive">*</span></Label>
                    <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Select value={expenseType} onValueChange={(value) => setExpenseType(value as ExpenseType)} className="pl-10">
                        <SelectTrigger id="expenseType" className="pl-10">
                            <SelectValue placeholder="Select expense type" />
                        </SelectTrigger>
                        <SelectContent>
                            {expenseTypeOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    {formErrors.type && <p className="text-sm text-destructive mt-1">{formErrors.type}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD) <span className="text-destructive">*</span></Label>
                <Input 
                    id="amount" 
                    type="number"
                    placeholder="e.g., 25.50" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    min="0.01"
                    step="0.01"
                />
                {formErrors.amount && <p className="text-sm text-destructive mt-1">{formErrors.amount}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea 
                    id="notes" 
                    placeholder="e.g., Lunch meeting with client, Toll charges" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[100px] pl-10"
                    />
                </div>
                {formErrors.notes && <p className="text-sm text-destructive mt-1">{formErrors.notes}</p>}
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="receiptImageUri">Receipt Image URL (Optional)</Label>
                 <div className="relative">
                    <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="receiptImageUri" 
                        type="url"
                        placeholder="https://example.com/receipt.jpg" 
                        value={receiptImageUri} 
                        onChange={(e) => setReceiptImageUri(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {formErrors.receiptImageUri && <p className="text-sm text-destructive mt-1">{formErrors.receiptImageUri}</p>}
            </div>
            
            <div className="pt-2">
              <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || loadingProjects || !selectedProjectId}>
                {isSubmitting ? "Logging Expense..." : <><PlusCircle className="mr-2 h-4 w-4" /> Log Expense</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

    