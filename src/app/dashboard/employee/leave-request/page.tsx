"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RefreshCw, CalendarIcon, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { requestLeave, getLeaveRequests, RequestLeaveInput } from '@/app/actions/leave/leaveActions';
import { format } from 'date-fns';

const leaveTypes = ['sick','casual','unpaid'] as const;

export default function LeaveRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [projectId, setProjectId] = useState('');
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [leaveType, setLeaveType] = useState<typeof leaveTypes[number]>('sick');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await getLeaveRequests(user.id);
    if (!('error' in result)) {
      setRequests(result);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      setRequests([]);
    }
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => { if (user && !authLoading) loadRequests(); }, [user, authLoading, loadRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !fromDate || !toDate) {
      toast({ title: 'Missing Data', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const input: RequestLeaveInput = { projectId: projectId || undefined, fromDate, toDate, leaveType, reason };
    const result = await requestLeave(user.id, input);
    if (result.success) {
      toast({ title: 'Leave Requested', description: result.message });
      setProjectId('');
      setFromDate(undefined);
      setToDate(undefined);
      setLeaveType('sick');
      setReason('');
      loadRequests();
    } else {
      toast({ title: 'Request Failed', description: result.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const formatDate = (d: any) => format(typeof d === 'string' ? new Date(d) : d, 'PP');

  if (authLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) {
    return <div className="p-4"><PageHeader title="Access Denied" description="Please log in."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Requests" description="Submit and view your leave requests." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Request Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="projectId">Project (optional)</Label>
                <Input id="projectId" value={projectId} onChange={e => setProjectId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={v => setLeaveType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} /></PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <Button type="submit" disabled={submitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Request Leave
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">My Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-center">No requests found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dates</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.fromDate)} - {formatDate(r.toDate)}</TableCell>
                    <TableCell>{r.leaveType}</TableCell>
                    <TableCell>{r.status}</TableCell>
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
