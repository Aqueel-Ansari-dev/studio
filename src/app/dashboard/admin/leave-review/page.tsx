
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { getLeaveRequestsForReview, reviewLeaveRequest, type LeaveRequest } from '@/app/actions/leave/leaveActions';
import { fetchUsersByRole, type UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function LeaveReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const employeeMap = useMemo(() => {
    return new Map(employees.map(emp => [emp.id, emp.name]));
  }, [employees]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [reqResult, empResult] = await Promise.all([
        getLeaveRequestsForReview(user.id),
        fetchUsersByRole('employee') // Fetch all roles if needed, or specific ones
      ]);

      if (!('error' in reqResult)) {
        setRequests(reqResult);
      } else {
        toast({ title: 'Error Loading Requests', description: reqResult.error, variant: 'destructive' });
        setRequests([]);
      }
      setEmployees(empResult);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load data.', variant: 'destructive' });
    }
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => { if (user && !authLoading) loadData(); }, [user, authLoading, loadData]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!user?.id) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    const result = await reviewLeaveRequest(user.id, id, action);
    if (result.success) {
      toast({ title: result.message });
      loadData(); // Refresh data to reflect status change
    } else {
      toast({ title: 'Action Failed', description: result.message, variant: 'destructive' });
    }
    setActionLoading(prev => ({ ...prev, [id]: false }));
  };

  const formatDate = (d: any) => format(typeof d === 'string' ? new Date(d) : d, 'PP');

  const getStatusBadge = (status: LeaveRequest['status']) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 text-white">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (authLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
    return <div className="p-4"><PageHeader title="Access Denied" description="Admin or Supervisor access required."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Review" description="Approve or reject employee leave requests." />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-center">No leave requests found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{employeeMap.get(r.employeeId) || r.employeeId.substring(0,8)+"..."}</TableCell>
                    <TableCell>{formatDate(r.fromDate)} - {formatDate(r.toDate)}</TableCell>
                    <TableCell>{r.leaveType}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {r.status === 'pending' ? (
                        <>
                          <Button size="icon" variant="outline" disabled={actionLoading[r.id]} onClick={() => handleAction(r.id, 'approve')} title="Approve">
                            {actionLoading[r.id] ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="outline" disabled={actionLoading[r.id]} onClick={() => handleAction(r.id, 'reject')} title="Reject" className="hover:bg-destructive/10 hover:text-destructive">
                             {actionLoading[r.id] ? <RefreshCw className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Processed</span>
                      )}
                    </TableCell>
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
