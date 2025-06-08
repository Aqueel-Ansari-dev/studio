
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RefreshCw, CalendarIcon, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { requestLeave, getLeaveRequests, RequestLeaveInput, LeaveRequest } from '@/app/actions/leave/leaveActions';
import { fetchAllProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input'; 
import { Textarea } from '@/components/ui/textarea'; 

const leaveTypes = ['sick','casual','unpaid'] as const;

export default function LeaveRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectForSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);


  const [projectId, setProjectId] = useState<string | undefined>(undefined); 
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [leaveType, setLeaveType] = useState<typeof leaveTypes[number]>('sick');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const result: FetchAllProjectsResult = await fetchAllProjects();
      if (result.success && result.projects) {
        setAllProjects(result.projects);
      } else {
        setAllProjects([]);
        console.error("Failed to fetch projects:", result.error);
        toast({ title: 'Error loading projects', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error loading projects', variant: 'destructive' });
      setAllProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [toast]);
  
  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await getLeaveRequests(user.id);
    if (!('error' in result)) {
      setRequests(result);
    } else {
      toast({ title: 'Error Loading Requests', description: result.error, variant: 'destructive' });
      setRequests([]);
    }
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => { 
    if (user && !authLoading) {
      loadRequests();
      loadProjects();
    }
  }, [user, authLoading, loadRequests, loadProjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !fromDate || !toDate || !reason.trim()) {
      toast({ title: 'Missing Data', description: 'Please fill all required fields (From Date, To Date, Reason).', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const input: RequestLeaveInput = { projectId: projectId || undefined, fromDate, toDate, leaveType, reason };
    const result = await requestLeave(user.id, input);
    if (result.success) {
      toast({ title: 'Leave Requested', description: result.message });
      setProjectId(undefined);
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
                <Label htmlFor="projectId">Project (Optional)</Label>
                <Select value={projectId} onValueChange={(value) => setProjectId(value === "none" ? undefined : value)} disabled={loadingProjects}>
                  <SelectTrigger id="projectId">
                    <SelectValue placeholder={loadingProjects ? "Loading..." : "Select project (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific project</SelectItem>
                    {allProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={v => setLeaveType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fromDate">From <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" id="fromDate">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="toDate">To <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" id="toDate">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} /></PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Reason <span className="text-destructive">*</span></Label>
              <Textarea id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief reason for leave" />
            </div>
            <Button type="submit" disabled={submitting || loadingProjects} className="bg-accent hover:bg-accent/90 text-accent-foreground">
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
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.fromDate)} - {formatDate(r.toDate)}</TableCell>
                    <TableCell>{r.leaveType.charAt(0).toUpperCase() + r.leaveType.slice(1)}</TableCell>
                    <TableCell>{r.projectId ? (allProjects.find(p=>p.id === r.projectId)?.name || r.projectId.substring(0,8)+"...") : 'N/A'}</TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
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
