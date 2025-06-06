
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, RefreshCw, Eye, DollarSign } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
// Assuming EmployeeExpense type in database.ts includes reviewedAt
import type { EmployeeExpense } from '@/types/database'; 
import { 
  fetchExpensesForReview, 
  approveEmployeeExpense, 
  rejectEmployeeExpense,
  ExpenseForReview 
} from '@/app/actions/supervisor/reviewExpenseActions';
import { fetchUsersByRole, UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { format } from 'date-fns';

export default function ExpenseReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [pendingExpenses, setPendingExpenses] = useState<ExpenseForReview[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({}); // For approve/reject actions

  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [expenseToManage, setExpenseToManage] = useState<ExpenseForReview | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const [showExpenseDetailsDialog, setShowExpenseDetailsDialog] = useState(false);


  const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp.name])), [employees]);
  const projectMap = useMemo(() => new Map(projects.map(proj => [proj.id, proj.name])), [projects]);

  const loadData = useCallback(async () => {
    if (!user?.id || (user.role !== 'supervisor' && user.role !== 'admin')) {
      if (!authLoading) toast({ title: "Unauthorized", description: "Access denied.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [expensesResult, employeesResult, projectsResult] = await Promise.all([
        fetchExpensesForReview(user.id),
        fetchUsersByRole('employee'), 
        fetchAllProjects()
      ]);

      if ('error' in expensesResult) {
        toast({ title: "Error Loading Expenses", description: expensesResult.error, variant: "destructive" });
        setPendingExpenses([]);
      } else {
        setPendingExpenses(expensesResult);
      }
      setEmployees(employeesResult);
      setProjects(projectsResult);

    } catch (error) {
      toast({ title: "Error Loading Data", description: "Could not load necessary data for review.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && user) { // Ensure user is loaded and available
      loadData();
    }
  }, [loadData, authLoading, user]);

  const handleApprove = async (expenseId: string) => {
    if (!user?.id) return;
    setIsProcessing(prev => ({ ...prev, [expenseId]: true }));
    const result = await approveEmployeeExpense({ expenseId, supervisorId: user.id });
    if (result.success) {
      toast({ title: "Expense Approved", description: result.message });
      loadData(); // Refresh list
    } else {
      toast({ title: "Approval Failed", description: result.message, variant: "destructive" });
    }
    setIsProcessing(prev => ({ ...prev, [expenseId]: false }));
  };

  const openRejectDialog = (expense: ExpenseForReview) => {
    setExpenseToManage(expense);
    setRejectionReason("");
    setShowRejectionDialog(true);
  };

  const handleRejectSubmit = async () => {
    if (!expenseToManage || !user?.id || !rejectionReason.trim()) {
      toast({ title: "Error", description: "Expense or reason missing.", variant: "destructive"});
      return;
    }
    setIsProcessing(prev => ({ ...prev, [expenseToManage.id]: true }));
    setShowRejectionDialog(false);
    const result = await rejectEmployeeExpense({ expenseId: expenseToManage.id, supervisorId: user.id, rejectionReason });
    if (result.success) {
      toast({ title: "Expense Rejected", description: result.message });
      loadData(); // Refresh list
    } else {
      toast({ title: "Rejection Failed", description: result.message, variant: "destructive" });
    }
    setIsProcessing(prev => ({ ...prev, [(expenseToManage as ExpenseForReview).id]: false }));
    setExpenseToManage(null);
    setRejectionReason("");
  };
  
  const openDetailsDialog = (expense: ExpenseForReview) => {
    setExpenseToManage(expense);
    setShowExpenseDetailsDialog(true);
  };

  const formatCurrencyDisplay = (amount: number) => `$${amount.toFixed(2)}`;

  if (authLoading || (!user && isLoading)) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || (user.role !== 'supervisor' && user.role !== 'admin')) {
    return <div className="p-4"><PageHeader title="Access Denied" description="You do not have permission to review expenses."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Employee Expense Review" 
        description={`Review and manage employee-submitted expenses. ${pendingExpenses.length} item(s) pending.`}
        actions={<Button onClick={loadData} variant="outline" disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Pending Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : pendingExpenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No expenses are currently pending review.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{employeeMap.get(expense.employeeId) || expense.employeeId}</TableCell>
                    <TableCell>{projectMap.get(expense.projectId) || expense.projectId}</TableCell>
                    <TableCell><Badge variant="outline">{expense.type.charAt(0).toUpperCase() + expense.type.slice(1)}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrencyDisplay(expense.amount)}</TableCell>
                    <TableCell>{format(new Date(expense.createdAt), "PP")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetailsDialog(expense)} title="View Details" disabled={isProcessing[expense.id]}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openRejectDialog(expense)} className="border-destructive text-destructive hover:bg-destructive/10" disabled={isProcessing[expense.id]}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(expense.id)} className="bg-green-500 hover:bg-green-600 text-white" disabled={isProcessing[expense.id]}>
                        {isProcessing[expense.id] ? "Processing..." : <><CheckCircle className="mr-1 h-4 w-4" /> Approve</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      {expenseToManage && (
        <Dialog open={showRejectionDialog} onOpenChange={(isOpen) => { if(!isOpen) setExpenseToManage(null); setShowRejectionDialog(isOpen); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Expense: {formatCurrencyDisplay(expenseToManage.amount)} for {employeeMap.get(expenseToManage.employeeId)}</DialogTitle>
              <DialogDescription>Provide a reason for rejecting this expense.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="rejectionReasonDlg">Rejection Reason</Label>
              <Textarea 
                id="rejectionReasonDlg" 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                placeholder="e.g., Receipt missing, expense not project-related..."
                className="min-h-[100px]"
              />
               {rejectionReason.trim().length > 0 && rejectionReason.trim().length < 5 && <p className="text-xs text-destructive">Reason must be at least 5 characters.</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleRejectSubmit} variant="destructive" disabled={!rejectionReason.trim() || rejectionReason.trim().length < 5 || (expenseToManage && isProcessing[expenseToManage.id])}>
                {expenseToManage && isProcessing[expenseToManage.id] ? "Rejecting..." : "Submit Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Details Dialog */}
      {expenseToManage && (
        <Dialog open={showExpenseDetailsDialog} onOpenChange={(isOpen) => { if(!isOpen) setExpenseToManage(null); setShowExpenseDetailsDialog(isOpen); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline">Expense Details</DialogTitle>
              <DialogDescription>
                Expense of {formatCurrencyDisplay(expenseToManage.amount)} by {employeeMap.get(expenseToManage.employeeId)} on {format(new Date(expenseToManage.createdAt), "PPp")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              <p><strong>Project:</strong> {projectMap.get(expenseToManage.projectId) || 'N/A'}</p>
              <p><strong>Type:</strong> {expenseToManage.type.charAt(0).toUpperCase() + expenseToManage.type.slice(1)}</p>
              <p><strong>Amount:</strong> {formatCurrencyDisplay(expenseToManage.amount)}</p>
              <div>
                <strong>Notes:</strong>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap p-2 border rounded-md mt-1 bg-muted/50">{expenseToManage.notes || "No notes provided."}</p>
              </div>
              {expenseToManage.receiptImageUri ? (
                 <div>
                    <strong>Receipt:</strong>
                    {expenseToManage.receiptImageUri.startsWith('data:image') ? (
                        <Image src={expenseToManage.receiptImageUri} alt="Receipt" width={300} height={200} className="rounded-md mt-1 object-contain max-w-full border" data-ai-hint="expense receipt" />
                    ) : (
                        <Link href={expenseToManage.receiptImageUri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block mt-1">View Receipt Image</Link>
                    )}
                 </div>
              ) : (
                <p><strong>Receipt:</strong> Not provided.</p>
              )}
              <div><strong>Status:</strong> <Badge variant={expenseToManage.approved ? "default" : (expenseToManage.rejectionReason ? "destructive" : "outline")} className={expenseToManage.approved ? "bg-green-500 text-white" : ""}>{expenseToManage.approved ? "Approved" : (expenseToManage.rejectionReason ? "Rejected" : "Pending Review")}</Badge></div>
              {expenseToManage.approved && expenseToManage.approvedBy && <p><strong>Approved By:</strong> {employeeMap.get(expenseToManage.approvedBy) || expenseToManage.approvedBy} {expenseToManage.approvedAt && `at ${format(new Date(expenseToManage.approvedAt), "PPpp")}`}</p>}
              {expenseToManage.rejectionReason && <p><strong>Rejection Reason:</strong> {expenseToManage.rejectionReason}</p>}
              {/* Display reviewedAt if it exists and is different from approvedAt or if not approved */}
              {expenseToManage.reviewedAt && (!expenseToManage.approved || expenseToManage.reviewedAt !== expenseToManage.approvedAt) && <p><strong>Last Reviewed:</strong> {format(new Date(expenseToManage.reviewedAt), "PPpp")}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExpenseDetailsDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


    