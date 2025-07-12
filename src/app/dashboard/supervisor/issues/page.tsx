
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchIssues, updateIssueStatus, type FetchIssuesFilters } from '@/app/actions/issues/issueActions';
import type { Issue, IssueStatus, IssueSeverity } from '@/types/database';
import { fetchUsersByRole } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';
import type { UserForSelection, ProjectForSelection } from '@/types/database';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, RefreshCw, SlidersHorizontal } from 'lucide-react';

const severities: IssueSeverity[] = ['Low', 'Medium', 'High', 'Critical'];
const statuses: IssueStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

export default function IssueTrackerPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [reporters, setReporters] = useState<UserForSelection[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FetchIssuesFilters>({});
  
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [issuesRes, projectsRes, reportersRes] = await Promise.all([
        fetchIssues(user.id, filters),
        fetchAllProjects(user.id),
        fetchUsersByRole(user.id, 'employee'), // Could expand to include supervisors too
      ]);
      
      if (issuesRes.success && issuesRes.issues) setIssues(issuesRes.issues);
      else toast({ title: "Error", description: issuesRes.error || "Could not load issues.", variant: "destructive" });
      
      if (projectsRes.success && projectsRes.projects) setProjects(projectsRes.projects);
      if (reportersRes.success && reportersRes.users) setReporters(reportersRes.users);
      
    } catch (err) {
      toast({ title: "Error", description: "Could not load all necessary data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, filters, toast]);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user, loadData]);
  
  const handleFilterChange = (filterName: keyof FetchIssuesFilters, value: string) => {
    setFilters(prev => {
        const newFilters = { ...prev };
        if (value === 'all') {
            delete newFilters[filterName];
        } else {
            newFilters[filterName] = value as any;
        }
        return newFilters;
    });
  };
  
  const handleStatusChange = async (issueId: string, status: IssueStatus) => {
    if (!user?.id) return;
    setIsUpdatingStatus(prev => ({...prev, [issueId]: true}));
    const result = await updateIssueStatus(user.id, { issueId, status });
    if(result.success) {
        toast({ title: "Status Updated", description: result.message });
        loadData();
    } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsUpdatingStatus(prev => ({...prev, [issueId]: false}));
  };

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);
  const reporterMap = useMemo(() => new Map(reporters.map(r => [r.id, r.name])), [reporters]);

  const severityStyles: Record<IssueSeverity, string> = {
    'Low': 'bg-gray-100 text-gray-800',
    'Medium': 'bg-yellow-100 text-yellow-800',
    'High': 'bg-orange-100 text-orange-800',
    'Critical': 'bg-red-100 text-red-800',
  };

  const openIssuesCount = useMemo(() => issues.filter(i => i.status === 'Open' || i.status === 'In Progress').length, [issues]);
  const criticalIssuesCount = useMemo(() => issues.filter(i => i.severity === 'Critical' && i.status !== 'Closed').length, [issues]);

  return (
    <div className="space-y-6">
      <PageHeader title="Issue Tracker" description="Monitor and manage all reported issues across your projects." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Open Issues</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{openIssuesCount}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Critical Issues</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-destructive">{criticalIssuesCount}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Resolved Today</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">0</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Issues</CardTitle>
              <CardDescription>Filter and manage reported issues.</CardDescription>
            </div>
            <Button onClick={loadData} variant="outline" size="icon" disabled={isLoading}><RefreshCw className={isLoading ? "animate-spin" : ""} /></Button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select onValueChange={(v) => handleFilterChange('projectId', v)}><SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger><SelectContent><SelectItem value="all">All Projects</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            <Select onValueChange={(v) => handleFilterChange('status', v)}><SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select onValueChange={(v) => handleFilterChange('severity', v)}><SelectTrigger><SelectValue placeholder="All Severities" /></SelectTrigger><SelectContent><SelectItem value="all">All Severities</SelectItem>{severities.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Issue</TableHead><TableHead>Project</TableHead><TableHead>Severity</TableHead><TableHead>Reported</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Loading issues...</TableCell></TableRow>}
              {!isLoading && issues.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No issues found for the selected filters.</TableCell></TableRow>}
              {issues.map(issue => (
                <TableRow key={issue.id}>
                  <TableCell>
                    <p className="font-medium">{issue.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{issue.description}</p>
                  </TableCell>
                  <TableCell>{projectMap.get(issue.projectId) || 'N/A'}</TableCell>
                  <TableCell><Badge className={severityStyles[issue.severity]}>{issue.severity}</Badge></TableCell>
                  <TableCell>
                    <p>{reporterMap.get(issue.reportedBy) || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</p>
                  </TableCell>
                  <TableCell>
                    <Select value={issue.status} onValueChange={(s) => handleStatusChange(issue.id, s as IssueStatus)} disabled={isUpdatingStatus[issue.id]}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
