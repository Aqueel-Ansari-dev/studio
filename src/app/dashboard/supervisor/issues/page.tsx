
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchIssues, updateIssue, addCommentToIssue, type FetchIssuesFilters } from '@/app/actions/issues/issueActions';
import type { Issue, IssueStatus, IssueSeverity, UserForSelection, ProjectForSelection } from '@/types/database';
import { fetchUsersByRole } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, RefreshCw, SlidersHorizontal, Eye, Send, User } from 'lucide-react';
import Image from 'next/image';

const severities: IssueSeverity[] = ['Low', 'Medium', 'High', 'Critical'];
const statuses: IssueStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

export default function IssueTrackerPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<UserForSelection[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FetchIssuesFilters>({});
  
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});
  const [isAssigning, setIsAssigning] = useState<Record<string, boolean>>({});
  const [isAddingComment, setIsAddingComment] = useState(false);

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [issuesRes, projectsRes, adminsRes, supervisorsRes] = await Promise.all([
        fetchIssues(user.id, filters),
        fetchAllProjects(user.id),
        fetchUsersByRole(user.id, 'admin'),
        fetchUsersByRole(user.id, 'supervisor')
      ]);
      
      if (issuesRes.success && issuesRes.issues) setIssues(issuesRes.issues);
      else toast({ title: "Error", description: issuesRes.error || "Could not load issues.", variant: "destructive" });
      
      if (projectsRes.success && projectsRes.projects) setProjects(projectsRes.projects);
      
      const assignable = [
        ...(adminsRes.success && adminsRes.users ? adminsRes.users : []),
        ...(supervisorsRes.success && supervisorsRes.users ? supervisorsRes.users : [])
      ];
      setAssignableUsers(assignable);
      
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
  
  const handleAssignmentChange = async (issueId: string, assignedTo: string) => {
    if (!user?.id) return;
    setIsAssigning(prev => ({...prev, [issueId]: true}));
    const result = await updateIssue(user.id, { issueId, assignedTo });
    if(result.success) {
        toast({ title: "Issue Assigned", description: result.message });
        loadData();
    } else {
        toast({ title: "Assignment Failed", description: result.message, variant: "destructive" });
    }
    setIsAssigning(prev => ({...prev, [issueId]: false}));
  };

  const handleStatusChange = async (issueId: string, status: IssueStatus) => {
    if (!user?.id) return;
    setIsUpdatingStatus(prev => ({...prev, [issueId]: true}));
    const result = await updateIssue(user.id, { issueId, status });
    if(result.success) {
        toast({ title: "Status Updated", description: result.message });
        loadData();
    } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsUpdatingStatus(prev => ({...prev, [issueId]: false}));
  };

  const handleViewDetails = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDetailModalOpen(true);
  };
  
  const handleAddComment = async () => {
    if (!selectedIssue || !newComment.trim() || !user?.id) return;
    setIsAddingComment(true);
    const result = await addCommentToIssue(user.id, { issueId: selectedIssue.id, content: newComment });
    if (result.success && result.comment) {
      toast({ title: "Comment Added" });
      setNewComment("");
      // Optimistically update the comments in the dialog
      setSelectedIssue(prev => prev ? ({ ...prev, comments: [...(prev.comments || []), result.comment!]}) : null);
      // Refresh the main list in the background
      loadData();
    } else {
      toast({ title: "Error", description: "Failed to add comment.", variant: "destructive" });
    }
    setIsAddingComment(false);
  };
  
  const reporters = useMemo(() => {
    const reporterMap = new Map<string, UserForSelection>();
    issues.forEach(issue => {
        if (issue.reportedBy && !reporterMap.has(issue.reportedBy)) {
            // A simplified user object for the map. The full details aren't known here
            // but the name will be retrieved from the userMap later.
            reporterMap.set(issue.reportedBy, { id: issue.reportedBy, name: 'Unknown Reporter', role: 'employee', avatar: '' });
        }
    });
    return Array.from(reporterMap.values());
  }, [issues]);

  const userMap = useMemo(() => {
    const map = new Map<string, UserForSelection>();
    [...assignableUsers, ...reporters].forEach(u => {
        if (!map.has(u.id)) map.set(u.id, u);
    });
    return map;
  }, [assignableUsers, reporters]);

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);

  const severityStyles: Record<IssueSeverity, string> = {
    'Low': 'bg-gray-100 text-gray-800',
    'Medium': 'bg-yellow-100 text-yellow-800',
    'High': 'bg-orange-100 text-orange-800',
    'Critical': 'bg-red-100 text-red-800',
  };
  
  const allTeamMembers = useMemo(() => {
      const members = new Map<string, UserForSelection>();
      assignableUsers.forEach(u => members.set(u.id, u));
      return Array.from(members.values());
  }, [assignableUsers]);

  return (
    <div className="space-y-6">
      <PageHeader title="Issue Tracker" description="Monitor and manage all reported issues across your projects." />
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div><CardTitle>All Issues</CardTitle><CardDescription>Filter and manage reported issues.</CardDescription></div>
            <Button onClick={loadData} variant="outline" size="icon" disabled={isLoading}><RefreshCw className={isLoading ? "animate-spin" : ""} /></Button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
            <Select onValueChange={(v) => handleFilterChange('projectId', v)}><SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger><SelectContent><SelectItem value="all">All Projects</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            <Select onValueChange={(v) => handleFilterChange('status', v)}><SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select onValueChange={(v) => handleFilterChange('severity', v)}><SelectTrigger><SelectValue placeholder="All Severities" /></SelectTrigger><SelectContent><SelectItem value="all">All Severities</SelectItem>{severities.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select onValueChange={(v) => handleFilterChange('assignedTo', v)}><SelectTrigger><SelectValue placeholder="All Assignees" /></SelectTrigger><SelectContent><SelectItem value="all">All Assignees</SelectItem>{allTeamMembers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Issue</TableHead><TableHead>Project</TableHead><TableHead>Severity</TableHead><TableHead>Reported</TableHead><TableHead>Assigned To</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center">Loading issues...</TableCell></TableRow>}
              {!isLoading && issues.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No issues found for the selected filters.</TableCell></TableRow>}
              {issues.map(issue => (
                <TableRow key={issue.id}>
                  <TableCell>
                    <p className="font-medium">{issue.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{issue.description}</p>
                  </TableCell>
                  <TableCell>{projectMap.get(issue.projectId) || 'N/A'}</TableCell>
                  <TableCell><Badge className={severityStyles[issue.severity]}>{issue.severity}</Badge></TableCell>
                  <TableCell>
                    <p>{userMap.get(issue.reportedBy)?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</p>
                  </TableCell>
                  <TableCell>
                    <Select value={issue.assignedTo} onValueChange={(v) => handleAssignmentChange(issue.id, v)} disabled={isAssigning[issue.id]}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          {allTeamMembers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={issue.status} onValueChange={(s) => handleStatusChange(issue.id, s as IssueStatus)} disabled={isUpdatingStatus[issue.id]}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(issue)}><Eye className="mr-2 h-4 w-4"/>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {selectedIssue && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-headline text-xl">{selectedIssue.title}</DialogTitle>
                    <DialogDescription>Reported by {userMap.get(selectedIssue.reportedBy)?.name} about {projectMap.get(selectedIssue.projectId)}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    <p><strong className="font-semibold">Description:</strong> {selectedIssue.description}</p>
                    {selectedIssue.mediaUrl && <a href={selectedIssue.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Attachment</a>}
                    
                    <div className="space-y-2">
                        <h4 className="font-semibold">Comments ({selectedIssue.comments?.length || 0})</h4>
                        <div className="space-y-3 p-2 border rounded-md max-h-60 overflow-y-auto bg-muted/50">
                           {selectedIssue.comments && selectedIssue.comments.length > 0 ? selectedIssue.comments.map((c, idx) => (
                               <div key={idx} className="text-sm">
                                   <div className="flex items-center gap-2">
                                     <Image src={userMap.get(c.authorId)?.avatar || ''} alt="" width={24} height={24} className="rounded-full" data-ai-hint="employee avatar"/>
                                     <span className="font-medium">{userMap.get(c.authorId)?.name}</span>
                                     <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), {addSuffix: true})}</span>
                                   </div>
                                   <p className="pl-8">{c.content}</p>
                               </div>
                           )) : <p className="text-xs text-muted-foreground text-center p-4">No comments yet.</p>}
                        </div>
                         <div className="flex items-center gap-2">
                           <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." disabled={isAddingComment} />
                           <Button onClick={handleAddComment} size="icon" disabled={isAddingComment || !newComment.trim()}><Send className="h-4 w-4"/></Button>
                         </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
