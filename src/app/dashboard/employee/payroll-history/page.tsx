
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { getPayrollRecordsForEmployee } from '@/app/actions/payroll/fetchPayrollData';
import { fetchAllProjects, type ProjectForSelection, type FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import type { PayrollRecord } from '@/types/database';
import { format, parseISO, isValid } from 'date-fns';

export default function EmployeePayrollHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const projectMap = useMemo(() => {
    return new Map(projects.map(p => [p.id, p.name]));
  }, [projects]);

  const loadRecordsAndProjects = useCallback(async () => {
    if (!user?.id) return;
    setLoadingData(true);
    try {
      const [payrollResult, projectsResultPromise] = await Promise.all([
        getPayrollRecordsForEmployee(user.id),
        fetchAllProjects()
      ]);

      if (payrollResult.success && payrollResult.records) {
        setRecords(payrollResult.records);
      } else {
        toast({ title: "Failed to Load Records", description: payrollResult.error || "Could not fetch payroll records.", variant: "destructive" });
        setRecords([]);
      }
      
      const projectsResult: FetchAllProjectsResult = await projectsResultPromise;
      if (projectsResult.success && projectsResult.projects) {
        setProjects(projectsResult.projects);
      } else {
        setProjects([]);
        console.error("Failed to fetch projects:", projectsResult.error);
      }
    } catch (error) {
      toast({ title: "Error Loading Data", description: "Could not load payroll or project data.", variant: "destructive" });
      setRecords([]);
      setProjects([]);
    }
    setLoadingData(false);
  }, [user?.id, toast]);

  useEffect(() => { 
    if (user && !authLoading) {
      loadRecordsAndProjects();
    }
  }, [user, authLoading, loadRecordsAndProjects]);

  const formatDate = (value: any) => {
    const date = typeof value === 'string' ? parseISO(value) : value;
    if (!date || !isValid(new Date(date))) return 'N/A';
    return format(new Date(date), 'PP');
  };
  
  const formatCurrency = (amt?: number) => {
    if (typeof amt !== 'number' || isNaN(amt)) return '$0.00';
    return `$${amt.toFixed(2)}`;
  }

  if (authLoading || loadingData) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) {
    return <div className="p-4"><PageHeader title="Access Denied" description="Please log in to view this page."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll History" description="View your past payroll records." actions={<RefreshCw onClick={loadRecordsAndProjects} className={`h-5 w-5 cursor-pointer ${loadingData ? 'animate-spin' : ''}`} />} />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : records.length === 0 ? (
            <p className="text-muted-foreground text-center">No payroll records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead className="text-right">Hours Worked</TableHead>
                  <TableHead className="text-right">Task Pay</TableHead>
                  <TableHead className="text-right">Expense Pay</TableHead>
                  <TableHead className="text-right">Total Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{projectMap.get(r.projectId) || r.projectId.substring(0,8)+"..."}</TableCell>
                    <TableCell>{formatDate(r.payPeriod.start)} - {formatDate(r.payPeriod.end)}</TableCell>
                    <TableCell className="text-right">{(r.hoursWorked || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.taskPay)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.approvedExpenses)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.totalPay)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
