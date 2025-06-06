
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, Eye, DollarSign, AlertTriangle, CheckCircle, FileText, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchAllSupervisorViewExpenses, ExpenseForReview } from '@/app/actions/supervisor/reviewExpenseActions';
import { fetchUsersByRole, UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { format } from 'date-fns';

type ExpenseStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AllExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<ExpenseForReview[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatusFilter>('all');
  
  const [showExpenseDetailsDialog, setShowExpenseDetailsDialog] = useState(false);
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState<ExpenseForReview | null>(null);

  const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp.name])), [employees]);
  const projectMap = useMemo(() => new Map(projects.map(proj => [proj.id, proj.name])), [projects]);

  const loadReferenceData = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [employeesResult, projectsResult] = await Promise.all([
        fetchUsersByRole('employee'), 
        fetchAllProjects()
      ]);
      setEmployees(employeesResult);
      setProjects(projectsResult);
    } catch (error) {
      toast({ title: "Error Loading Reference Data", description: "Could not load employees or projects.", variant: "destructive" });
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);

  const loadExpenses = useCallback(async () => {
    if (!user?.id || (user.role !== 'supervisor' && user.role !== 'admin')) { // Use user?.id
      if (!authLoading) toast({ title: "Unauthorized", description: "Access denied.", variant: "destructive" });
      setIsLoadingExpenses(false);
      return;
    }
    setIsLoadingExpenses(true); 
    try {
      const expensesResult = await fetchAllSupervisorViewExpenses(user.id, { status: statusFilter });

      if ('error' in expensesResult) {
        toast({ title: "Error Loading Expenses", description: expensesResult.error, variant: "destructive" });
        setExpenses([]);
      } else {
        setExpenses(expensesResult);
      }
    } catch (error) {
      toast({ title: "Error Loading Expenses", description: "An unexpected error occurred.", variant: "destructive" });
      setExpenses([]);
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [user?.id, authLoading, statusFilter, toast]); // Depend on user?.id and statusFilter

  useEffect(() => {
    if (!authLoading && user?.id) { // Use user?.id
      loadReferenceData();
    }
  }, [authLoading, user?.id, loadReferenceData]); // Depend on user?.id

  useEffect(() => {
    if (!authLoading && user?.id && !isLoadingLookups) { // Use user?.id and ensure lookups are done
      loadExpenses();
    }
  }, [authLoading, user?.id, isLoadingLookups, loadExpenses]); // Depend on user?.id


  const openDetailsDialog = (expense: ExpenseForReview) => {
    setSelectedExpenseForDetails(expense);
    setShowExpenseDetailsDialog(true);
  };

  const formatCurrencyDisplay = (amount: number) => `$${amount.toFixed(2)}`;

  const getStatusBadge = (expense: ExpenseForReview) => {
    if (expense.approved) {
      return <Badge className="bg-green-500 text-white">Approved</Badge>;
    }
    if (expense.rejectionReason) {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
  };
  
  const statusOptions: ExpenseStatusFilter[] = ['all', 'pending', 'approved', 'rejected'];

  const isLoading = isLoadingExpenses || isLoadingLookups || authLoading;

  if (authLoading && isLoadingExpenses && isLoadingLookups) { 
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user && !authLoading) { 
    return <div className="p-4"><PageHeader title="Access Denied" description="You do not have permission to view this page."/></div>;
  }


  return (
    <div className="space-y-6">
      <PageHeader 
        title="All Employee Expenses" 
        description={`View all submitted expenses. Filter by status. (${isLoadingExpenses || isLoadingLookups ? "Loading..." : expenses.length + " items shown"})`}
        actions={
            <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ExpenseStatusFilter)} disabled={isLoadingExpenses || isLoadingLookups}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map(opt => (
                             <SelectItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={loadExpenses} variant="outline" disabled={isLoadingExpenses || isLoadingLookups}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingExpenses ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Expense Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingExpenses || isLoadingLookups ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="mt-2 text-muted-foreground">Loading expenses...</p></div>
          ) : expenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No expenses found matching the current filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{employeeMap.get(expense.employeeId) || expense.employeeId}</TableCell>
                    <TableCell>{projectMap.get(expense.projectId) || expense.projectId}</TableCell>
                    <TableCell><Badge variant="secondary">{expense.type.charAt(0).toUpperCase() + expense.type.slice(1)}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrencyDisplay(expense.amount)}</TableCell>
                    <TableCell>{format(new Date(expense.createdAt), "PP")}</TableCell>
                    <TableCell>{getStatusBadge(expense)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDetailsDialog(expense)} title="View Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedExpenseForDetails && (
        <Dialog open={showExpenseDetailsDialog} onOpenChange={(isOpen) => { if(!isOpen) setSelectedExpenseForDetails(null); setShowExpenseDetailsDialog(isOpen); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline">Expense Details</DialogTitle>
              <DialogDescription>
                Expense by {employeeMap.get(selectedExpenseForDetails.employeeId)} on {format(new Date(selectedExpenseForDetails.createdAt), "PPp")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              <p><strong>Project:</strong> {projectMap.get(selectedExpenseForDetails.projectId) || 'N/A'}</p>
              <p><strong>Type:</strong> {selectedExpenseForDetails.type.charAt(0).toUpperCase() + selectedExpenseForDetails.type.slice(1)}</p>
              <p><strong>Amount:</strong> {formatCurrencyDisplay(selectedExpenseForDetails.amount)}</p>
              <div>
                <strong>Notes:</strong>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap p-2 border rounded-md mt-1 bg-muted/50">{selectedExpenseForDetails.notes || "No notes provided."}</p>
              </div>
              {selectedExpenseForDetails.receiptImageUri ? (
                 <div>
                    <strong>Receipt:</strong>
                     {selectedExpenseForDetails.receiptImageUri.startsWith('data:image') ? (
                        <Image src={selectedExpenseForDetails.receiptImageUri} alt="Receipt" width={300} height={200} className="rounded-md mt-1 object-contain max-w-full border" data-ai-hint="expense receipt" />
                    ) : (
                        <Link href={selectedExpenseForDetails.receiptImageUri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block mt-1">View Receipt Image</Link>
                    )}
                 </div>
              ) : (
                <p><strong>Receipt:</strong> Not provided.</p>
              )}
              <div><strong>Status:</strong> {getStatusBadge(selectedExpenseForDetails)}</div>
              {selectedExpenseForDetails.approved && selectedExpenseForDetails.approvedBy && <p><strong>Approved By:</strong> {employeeMap.get(selectedExpenseForDetails.approvedBy) || selectedExpenseForDetails.approvedBy} {selectedExpenseForDetails.approvedAt && `at ${format(new Date(selectedExpenseForDetails.approvedAt), "PPpp")}`}</p>}
              {selectedExpenseForDetails.rejectionReason && <p className="text-sm"><strong className="text-destructive">Rejection Reason:</strong> {selectedExpenseForDetails.rejectionReason}</p>}
              {selectedExpenseForDetails.reviewedAt && (!selectedExpenseForDetails.approved || selectedExpenseForDetails.reviewedAt !== selectedExpenseForDetails.approvedAt) && <p className="text-xs text-muted-foreground">Last Reviewed: {format(new Date(selectedExpenseForDetails.reviewedAt), "PPpp")}</p>}
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

