
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { getPayrollRecordsForEmployee } from '@/app/actions/payroll/fetchPayrollData';
import type { PayrollRecord } from '@/types/database';
import { format, parseISO } from 'date-fns';

export default function EmployeePayrollHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await getPayrollRecordsForEmployee(user.id);
    if (result.success && result.records) {
      setRecords(result.records);
    } else {
      toast({ title: "Failed to Load Records", description: result.error || "Could not fetch payroll records.", variant: "destructive" });
      setRecords([]);
    }
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => { if (user && !authLoading) loadRecords(); }, [user, authLoading, loadRecords]);

  const formatDate = (value: any) => {
    const date = typeof value === 'string' ? parseISO(value) : value;
    if (!isValid(date)) return 'N/A';
    return format(date, 'PP');
  };

  const formatCurrency = (amt?: number) => {
    if (typeof amt !== 'number' || isNaN(amt)) return '$0.00';
    return `$${amt.toFixed(2)}`;
  }

  if (authLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) {
    return <div className="p-4"><PageHeader title="Access Denied" description="Please log in to view this page."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll History" description="View your past payroll records." actions={<RefreshCw onClick={loadRecords} className={`h-5 w-5 cursor-pointer ${loading ? 'animate-spin' : ''}`} />} />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                    <TableCell className="font-mono text-xs">{r.projectId.substring(0,8)}...</TableCell>
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
