
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, RefreshCw, Eye, DollarSign, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { getExpensesByEmployee, type EmployeeExpenseResult, type GetExpensesByEmployeeResult } from '@/app/actions/inventory-expense/getExpensesByEmployee';
import { fetchAllProjects, type ProjectForSelection, type FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { format } from 'date-fns';

const EXPENSES_PER_PAGE = 10;

export default function MyExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [allLoadedExpenses, setAllLoadedExpenses] = useState<EmployeeExpenseResult[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastExpenseCursor, setLastExpenseCursor] = useState<string | null | undefined>(undefined);
  const [hasMoreExpenses, setHasMoreExpenses] = useState(true);
  
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<EmployeeExpenseResult | null>(null);

  const projectMap = useMemo(() => new Map(projects.map(proj => [proj.id, proj.name])), [projects]);

  const loadProjects = useCallback(async () => {
    try {
      const projectsResult: FetchAllProjectsResult = await fetchAllProjects();
      if (projectsResult.success && projectsResult.projects) {
        setProjects(projectsResult.projects);
      } else {
        setProjects([]);
        console.error("Failed to fetch projects:", projectsResult.error);
      }
    } catch (error) {
      console.error("Error loading projects for My Expenses:", error);
      setProjects([]);
    }
  }, []);

  const loadExpensesData = useCallback(async (loadMore = false) => {
    if (!user?.id) {
      if (!authLoading) toast({ title: "Authentication Error", variant: "destructive" });
      if (!loadMore) setIsLoading(false); else setIsLoadingMore(false);
      return;
    }

    if (!loadMore) {
      setIsLoading(true);
    } else {
      if (!hasMoreExpenses || lastExpenseCursor === null) return;
      setIsLoadingMore(true);
    }
    
    try {
      const expensesResult: GetExpensesByEmployeeResult = await getExpensesByEmployee(
        user.id, 
        user.id, 
        undefined, 
        EXPENSES_PER_PAGE, 
        loadMore ? lastExpenseCursor : undefined
      );

      if (expensesResult.success && expensesResult.expenses) {
        setAllLoadedExpenses(prev => loadMore ? [...prev, ...expensesResult.expenses!] : expensesResult.expenses!);
        setLastExpenseCursor(expensesResult.lastVisibleCreatedAtISO);
        setHasMoreExpenses(expensesResult.hasMore || false);
      } else {
        toast({ title: "Error Loading Expenses", description: expensesResult.error, variant: "destructive" });
        if (!loadMore) setAllLoadedExpenses([]);
        setHasMoreExpenses(false);
      }
    } catch (error) {
      console.error("Error loading data for My Expenses:", error);
      toast({ title: "Error Loading Data", variant: "destructive" });
    } finally {
      if (!loadMore) setIsLoading(false); else setIsLoadingMore(false);
    }
  }, [user?.id, authLoading, toast, lastExpenseCursor, hasMoreExpenses]);

  useEffect(() => {
    if (!authLoading && user) {
      loadProjects();
      loadExpensesData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);


  const openDetailsDialog = (expense: EmployeeExpenseResult) => {
    setSelectedExpense(expense);
    setShowDetailsDialog(true);
  };

  const formatCurrencyDisplay = (amount: number) => `$${amount.toFixed(2)}`;

  const getStatusBadge = (expense: EmployeeExpenseResult) => {
    if (expense.approved) {
      return <Badge className="bg-green-500 text-white hover:bg-green-600">Approved</Badge>;
    }
    if (expense.rejectionReason) {
      return <Badge variant="destructive" className="cursor-pointer" onClick={() => openDetailsDialog(expense)}>Rejected</Badge>;
    }
    return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
  };

  if (authLoading || (isLoading && allLoadedExpenses.length === 0)) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) { 
    return <div className="p-4"><PageHeader title="Access Denied" description="Please log in to view your expenses."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Expenses" 
        description={`View and manage your submitted expenses. ${isLoading ? "Loading..." : allLoadedExpenses.length + " item(s) shown."}`}
        actions={
            <div className="flex items-center gap-2">
                <Button onClick={() => loadExpensesData(false)} variant="outline" disabled={isLoading || isLoadingMore}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${(isLoading && !isLoadingMore) ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Link href="/dashboard/employee/expenses/log-expense">
                        <PlusCircle className="mr-2 h-4 w-4" /> Log New Expense
                    </Link>
                </Button>
            </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Expense History</CardTitle>
        </CardHeader>
        <CardContent>
          {(isLoading && allLoadedExpenses.length === 0) ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="mt-2 text-muted-foreground">Loading your expenses...</p></div>
          ) : allLoadedExpenses.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <DollarSign className="mx-auto h-12 w-12 mb-4"/>
                <p className="font-semibold">No expenses logged yet.</p>
                <p>Click "Log New Expense" to get started.</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLoadedExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{projectMap.get(expense.projectId) || expense.projectId}</TableCell>
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
            {hasMoreExpenses && (
                <div className="mt-6 text-center">
                    <Button onClick={() => loadExpensesData(true)} disabled={isLoadingMore || isLoading}>
                    {isLoadingMore ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ChevronDown className="mr-2 h-4 w-4"/>}
                    Load More Expenses
                    </Button>
                </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedExpense && (
        <Dialog open={showDetailsDialog} onOpenChange={(isOpen) => { if(!isOpen) setSelectedExpense(null); setShowDetailsDialog(isOpen); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline">Expense Details</DialogTitle>
              <DialogDescription>
                For project: {projectMap.get(selectedExpense.projectId) || 'N/A'} on {format(new Date(selectedExpense.createdAt), "PPp")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              <p><strong>Type:</strong> {selectedExpense.type.charAt(0).toUpperCase() + selectedExpense.type.slice(1)}</p>
              <p><strong>Amount:</strong> {formatCurrencyDisplay(selectedExpense.amount)}</p>
              <div>
                <strong>Notes:</strong>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap p-2 border rounded-md mt-1 bg-muted/50">{selectedExpense.notes || "No notes provided."}</p>
              </div>
              {selectedExpense.receiptImageUri ? (
                 <div>
                    <strong>Receipt:</strong>
                     {selectedExpense.receiptImageUri.startsWith('data:image') ? (
                        <Image src={selectedExpense.receiptImageUri} alt="Receipt" width={300} height={200} className="rounded-md mt-1 object-contain max-w-full border" data-ai-hint="expense receipt" />
                    ) : (
                        <Link href={selectedExpense.receiptImageUri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block mt-1">View Receipt Image</Link>
                    )}
                 </div>
              ) : (
                <p><strong>Receipt:</strong> Not provided.</p>
              )}
              <div><strong>Status:</strong> {getStatusBadge(selectedExpense)}</div>
              {selectedExpense.approved && selectedExpense.approvedBy && <p className="text-xs text-muted-foreground">Approved By: {selectedExpense.approvedBy} {selectedExpense.approvedAt && `at ${format(new Date(selectedExpense.approvedAt), "PPpp")}`}</p>}
              {selectedExpense.rejectionReason && <p className="text-sm"><strong className="text-destructive">Rejection Reason:</strong> {selectedExpense.rejectionReason}</p>}
              {selectedExpense.reviewedAt && (!selectedExpense.approved || selectedExpense.reviewedAt !== selectedExpense.approvedAt) && <p className="text-xs text-muted-foreground">Last Reviewed: {format(new Date(selectedExpense.reviewedAt), "PPpp")}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
