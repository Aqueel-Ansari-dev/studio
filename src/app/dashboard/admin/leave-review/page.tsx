"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { getLeaveRequestsForReview, reviewLeaveRequest } from '@/app/actions/leave/leaveActions';
import { format } from 'date-fns';

export default function LeaveReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await getLeaveRequestsForReview(user.id);
    if (!('error' in result)) {
      setRequests(result);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      setRequests([]);
    }
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => { if (user && !authLoading) load(); }, [user, authLoading, load]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!user?.id) return;
    setActionLoading(true);
    const result = await reviewLeaveRequest(user.id, id, action);
    if (result.success) {
      toast({ title: result.message });
      load();
    } else {
      toast({ title: 'Action Failed', description: result.message, variant: 'destructive' });
    }
    setActionLoading(false);
  };

  const formatDate = (d: any) => format(typeof d === 'string' ? new Date(d) : d, 'PP');

  if (authLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user || user.role !== 'admin') {
    return <div className="p-4"><PageHeader title="Access Denied" description="Admin access required."/></div>;
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
            <p className="text-muted-foreground text-center">No leave requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.employeeId.substring(0,8)}...</TableCell>
                    <TableCell>{formatDate(r.fromDate)} - {formatDate(r.toDate)}</TableCell>
                    <TableCell>{r.leaveType}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="icon" variant="outline" disabled={actionLoading} onClick={() => handleAction(r.id, 'approve')}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="outline" disabled={actionLoading} onClick={() => handleAction(r.id, 'reject')}><X className="h-4 w-4" /></Button>
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
