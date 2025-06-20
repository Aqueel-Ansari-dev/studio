
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, Eye, DollarSign, AlertTriangle, CheckCircle, FileText, XCircle, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchAllSupervisorViewExpenses, ExpenseForReview } from '@/app/actions/supervisor/reviewExpenseActions'; 
import { fetchUsersByRole, UserForSelection, FetchUsersByRoleResult } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { format } from 'date-fns';

type ExpenseStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AllExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<ExpenseForReview[]>([]);
  // Employees and Projects are fetched here mainly for the Dialog,
  // as the server action now enriches the main expense list items.
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatusFilter>('all');
  
  const [showExpenseDetailsDialog, setShowExpenseDetailsDialog] = useState(false);
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState<ExpenseForReview | null>(null);

  // These maps are still useful for the dialog if it needs to look up related entities (like approver name).
  const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp.name])), [employees]);
  const projectMap = useMemo(() => new Map(projects.map(proj => [proj.id, proj.name])), [projects]);

  const loadReferenceData = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [employeesResult, supervisorsResult, adminsResult, projectsResult]: [FetchUsersByRoleResult, FetchUsersByRoleResult, FetchUsersByRoleResult, FetchAllProjectsResult] = await Promise.all([
        fetchUsersByRole('employee'), 
        fetchUsersByRole('supervisor'),
        fetchUsersByRole('admin'),
        fetchAllProjects()
      ]);

      let allUsers: UserForSelection[] = [];
      if (employeesResult.success && employeesResult.users) {
        allUsers = allUsers.concat(employeesResult.users);
      } else {
        console.error("Failed to fetch employees:", employeesResult.error || "Unknown error fetching employees.");
      }
      
      if (supervisorsResult.success && supervisorsResult.users) {
        allUsers = allUsers.concat(supervisorsResult.users);
      } else {
        console.error("Failed to fetch supervisors:", supervisorsResult.error || "Unknown error fetching supervisors.");
      }

      if (adminsResult.success && adminsResult.users) {
        allUsers = allUsers.concat(adminsResult.users);
      } else {
        console.error("Failed to fetch admins:", adminsResult.error || "Unknown error fetching admins.");
      }
      setEmployees(allUsers);


      if (projectsResult.success && projectsResult.projects) {
        setProjects(projectsResult.projects);
      } else {
        setProjects([]);
        console.error("Failed to fetch projects:", projectsResult.error || "Unknown error fetching projects.");
      }
    } catch (error) {
      toast({ title: "Error Loading Reference Data", description: "Could not load employees or projects.", variant: "destructive" });
      setEmployees([]);
      setProjects([]);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);

  const loadExpenses = useCallback(async () => {
    if (!user?.id || user.role !== 'admin') { 
      if (!authLoading) toast({ title: "Unauthorized", description: "Access denied.", variant: "destructive" });
      setIsLoadingExpenses(false);
      return;
    }
    setIsLoadingExpenses(true); 
    try {
      const expensesResult = await fetchAllSupervisorViewExpenses(user.id, { status: statusFilter });

      if (expensesResult.success && expensesResult.expenses) {
        setExpenses(expensesResult.expenses);
      } else {
        toast({ title: "Error Loading Expenses", description: expensesResult.error || "Failed to load expenses data.", variant: "destructive" });
        setExpenses([]);
      }
    } catch (error) {
      toast({ title: "Error Loading Expenses", description: "An unexpected error occurred.", variant: "destructive" });
      setExpenses([]);
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [user, authLoading, statusFilter, toast]); 

  useEffect(() => {
    if (!authLoading && user?.id) { 
      loadReferenceData();
    }
  }, [authLoading, user?.id, loadReferenceData]); 

  useEffect(() => {
    if (!authLoading && user?.id && !isLoadingLookups) { 
      loadExpenses();
    }
  }, [authLoading, user?.id, isLoadingLookups, loadExpenses]); 


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

  if (!user || user.role !== 'admin') {
    return (
        <div className="p-4">
            <PageHeader title="Access Denied" description="Only administrators can access this page."/>
            <Card className="mt-4">
                <CardContent className="p-6 text-center">
                    <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
                    <p className="mt-2 font-semibold">Access Restricted</p>
                     <Button asChild variant="outline" className="mt-4">
                        <Link href="/dashboard">Go to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader 
        title="All Employee Expenses (Admin)" 
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
                    <TableCell className="font-medium">{expense.employeeName || expense.employeeId}</TableCell>
                    <TableCell>{expense.projectName || expense.projectId}</TableCell>
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

      {selectedExpenseForDetails && (
        <Dialog open={showExpenseDetailsDialog} onOpenChange={(isOpen) => { if(!isOpen) setSelectedExpenseForDetails(null); setShowExpenseDetailsDialog(isOpen); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline">Expense Details</DialogTitle>
              <DialogDescription>
                Expense by {selectedExpenseForDetails.employeeName || employeeMap.get(selectedExpenseForDetails.employeeId)} on {format(new Date(selectedExpenseForDetails.createdAt), "PPp")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              <p><strong>Project:</strong> {selectedExpenseForDetails.projectName || projectMap.get(selectedExpenseForDetails.projectId) || 'N/A'}</p>
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

