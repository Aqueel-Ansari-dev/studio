
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, CheckCircle, XCircle, MessageSquare, AlertTriangle, Eye } from "lucide-react";
import Image from "next/image";
import type { Task, TaskStatus } from '@/types/database';
import { fetchTasksForSupervisor, FetchTasksFilters } from '@/app/actions/supervisor/fetchTasks';
import { approveTaskBySupervisor, rejectTaskBySupervisor } from '@/app/actions/supervisor/reviewTask';
import { fetchUsersByRole, UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';

export default function TaskMonitorPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [isReviewingTask, setIsReviewingTask] = useState<Record<string, boolean>>({});


  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const { toast } = useToast();

  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [taskToReject, setTaskToReject] = useState<Task | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [showTaskDetailsDialog, setShowTaskDetailsDialog] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);


  const employeeMap = useMemo(() => {
    return new Map(employees.map(emp => [emp.id, emp]));
  }, [employees]);

  const projectMap = useMemo(() => {
    return new Map(projects.map(proj => [proj.id, proj]));
  }, [projects]);

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [fetchedEmployees, fetchedProjects] = await Promise.all([
        fetchUsersByRole('employee'),
        fetchAllProjects()
      ]);
      setEmployees(fetchedEmployees);
      setProjects(fetchedProjects);
    } catch (error) {
      toast({
        title: "Error fetching lookup data",
        description: "Could not load employees or projects.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);
  
  const loadTasks = useCallback(async () => {
    if (!user) {
      toast({ title: "Authentication Error", description: "Supervisor not found.", variant: "destructive" });
      setIsLoadingTasks(false);
      return;
    }
    setIsLoadingTasks(true);
    const filters: FetchTasksFilters = {};
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    if (projectFilter !== "all") {
      filters.projectId = projectFilter;
    }

    const result = await fetchTasksForSupervisor(user.id, filters);
    if (result.success && result.tasks) {
      setTasks(result.tasks);
    } else {
      toast({
        title: "Error fetching tasks",
        description: result.message || "Could not load tasks.",
        variant: "destructive",
      });
      setTasks([]);
    }
    setIsLoadingTasks(false);
  }, [statusFilter, projectFilter, toast, user]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (!isLoadingLookups && user) {
        loadTasks();
    }
  }, [loadTasks, isLoadingLookups, user]);

  const handleApproveTask = async (taskId: string) => {
    if (!user) return;
    setIsReviewingTask(prev => ({...prev, [taskId]: true}));
    const result = await approveTaskBySupervisor({ taskId, supervisorId: user.id });
    if (result.success) {
      toast({ title: "Task Approved", description: result.message });
      loadTasks(); // Refresh task list
    } else {
      toast({ title: "Approval Failed", description: result.message, variant: "destructive" });
    }
    setIsReviewingTask(prev => ({...prev, [taskId]: false}));
  };

  const openRejectDialog = (task: Task) => {
    setTaskToReject(task);
    setRejectionReason(task.supervisorReviewNotes || ""); // Pre-fill if previously rejected
    setShowRejectionDialog(true);
  };

  const handleRejectTaskSubmit = async () => {
    if (!taskToReject || !user || !rejectionReason.trim()) {
      toast({ title: "Error", description: "Task or reason missing for rejection.", variant: "destructive"});
      return;
    }
    setIsReviewingTask(prev => ({...prev, [taskToReject.id]: true}));
    setShowRejectionDialog(false);
    const result = await rejectTaskBySupervisor({ taskId: taskToReject.id, supervisorId: user.id, rejectionReason });
    if (result.success) {
      toast({ title: "Task Rejected", description: result.message });
      loadTasks(); // Refresh task list
    } else {
      toast({ title: "Rejection Failed", description: result.message, variant: "destructive" });
    }
    setTaskToReject(null);
    setRejectionReason("");
    setIsReviewingTask(prev => ({...prev, [(taskToReject as Task).id]: false}));
  };
  
  const openDetailsDialog = (task: Task) => {
    setSelectedTaskForDetails(task);
    setShowTaskDetailsDialog(true);
  };

  const searchedTasks = tasks.filter(task => {
    const employeeName = employeeMap.get(task.assignedEmployeeId)?.name || task.assignedEmployeeId;
    const projectName = projectMap.get(task.projectId)?.name || task.projectId;
    return (
      task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      projectName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  
  const taskStatuses: (TaskStatus | "all")[] = ["all", "pending", "in-progress", "paused", "completed", "needs-review", "verified", "rejected"];

  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'default'; 
      case 'in-progress': return 'secondary';
      case 'needs-review': return 'outline'; 
      case 'pending': case 'paused': case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

   const getStatusBadgeClassName = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'bg-green-500 text-white';
      case 'needs-review': return 'border-yellow-500 text-yellow-600';
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      default: return '';
    }
  };

  const isLoading = isLoadingTasks || isLoadingLookups;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Task Monitor" 
        description="Oversee and track the status of all assigned tasks. Review tasks requiring attention."
        actions={<Button onClick={loadTasks} variant="outline" disabled={isLoading || !user}><RefreshCw className={`mr-2 h-4 w-4 ${isLoadingTasks ? 'animate-spin' : ''}`} /> Refresh Tasks</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search loaded tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter} disabled={isLoading || projects.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingLookups ? "Loading projects..." : "Filter by project"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(proj => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
                 {(!isLoadingLookups && projects.length === 0) && <SelectItem value="no-projects" disabled>No projects found</SelectItem>}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {taskStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status === "all" ? "All Statuses" : status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Task List</CardTitle>
          <CardDescription>
            Showing {searchedTasks.length} task(s). 
            {searchTerm && ` (Filtered by search term "${searchTerm}")`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchedTasks.length > 0 ? searchedTasks.map((task) => {
                  const employee = employeeMap.get(task.assignedEmployeeId);
                  const project = projectMap.get(task.projectId);
                  const currentReviewingState = isReviewingTask[task.id] || false;
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Image src={employee?.avatar || `https://placehold.co/32x32.png?text=${employee?.name?.substring(0,1)||"E"}`} alt={employee?.name || task.assignedEmployeeId} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar" />
                          <span className="font-medium">{employee?.name || task.assignedEmployeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>{task.taskName}</TableCell>
                      <TableCell>{project?.name || task.projectId}</TableCell>
                      <TableCell>{task.dueDate ? format(new Date(task.dueDate as string), "PP") : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(task.status)}
                          className={getStatusBadgeClassName(task.status)}
                        >
                          {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetailsDialog(task)} title="View Details" disabled={currentReviewingState}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {task.status === 'needs-review' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openRejectDialog(task)} className="border-destructive text-destructive hover:bg-destructive/10" disabled={currentReviewingState}>
                              <XCircle className="mr-1 h-4 w-4" /> Reject
                            </Button>
                            <Button size="sm" onClick={() => handleApproveTask(task.id)} className="bg-green-500 hover:bg-green-600 text-white" disabled={currentReviewingState}>
                              {currentReviewingState ? 'Processing...' : <><CheckCircle className="mr-1 h-4 w-4" /> Approve</>}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No tasks match the current filters, or no tasks found for this supervisor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {taskToReject && (
        <Dialog open={showRejectionDialog} onOpenChange={(isOpen) => {
            if (!isOpen) { setTaskToReject(null); setRejectionReason(""); }
            setShowRejectionDialog(isOpen);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Task: {taskToReject.taskName}</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting this task. This will be visible to the employee.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea 
                id="rejectionReason" 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                placeholder="e.g., Submitted media is unclear, task not fully completed..."
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleRejectTaskSubmit} variant="destructive" disabled={!rejectionReason.trim() || rejectionReason.trim().length < 5 || isReviewingTask[taskToReject.id]}>
                {isReviewingTask[taskToReject.id] ? "Rejecting..." : "Submit Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedTaskForDetails && (
        <Dialog open={showTaskDetailsDialog} onOpenChange={(isOpen) => {
            if(!isOpen) setSelectedTaskForDetails(null);
            setShowTaskDetailsDialog(isOpen);
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-headline">Task Details: {selectedTaskForDetails.taskName}</DialogTitle>
              <DialogDescription>
                Assigned to: {employeeMap.get(selectedTaskForDetails.assignedEmployeeId)?.name || 'N/A'} for project: {projectMap.get(selectedTaskForDetails.projectId)?.name || 'N/A'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
              <p><strong className="font-medium">Status:</strong> {selectedTaskForDetails.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
              <p><strong className="font-medium">Description:</strong> {selectedTaskForDetails.description || "N/A"}</p>
              {selectedTaskForDetails.supervisorNotes && <p><strong className="font-medium">Supervisor Assignment Notes:</strong> {selectedTaskForDetails.supervisorNotes}</p>}
              
              {selectedTaskForDetails.employeeNotes && (
                <div className="p-3 border rounded-md bg-muted/50">
                  <h4 className="font-semibold text-sm flex items-center"><MessageSquare className="w-4 h-4 mr-2"/>Employee Notes</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTaskForDetails.employeeNotes}</p>
                </div>
              )}
              {selectedTaskForDetails.submittedMediaUri && selectedTaskForDetails.submittedMediaUri !== "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" && (
                 <div className="p-3 border rounded-md bg-muted/50">
                    <h4 className="font-semibold text-sm">Submitted Media</h4>
                    {/* Basic image display, in real app handle video/other types and better preview */}
                    {selectedTaskForDetails.submittedMediaUri.startsWith('data:image') ? (
                        <Image src={selectedTaskForDetails.submittedMediaUri} alt="Submitted media" width={200} height={150} className="rounded-md mt-2 object-contain max-w-full" data-ai-hint="task media" />
                    ) : (
                        <p className="text-xs text-muted-foreground">Media submitted (non-image or preview unavailable). URI: <span className="break-all">{selectedTaskForDetails.submittedMediaUri.substring(0,50)}...</span></p>
                    )}
                 </div>
              )}
               {selectedTaskForDetails.submittedMediaUri === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" && (
                 <div className="p-3 border rounded-md bg-muted/50">
                    <h4 className="font-semibold text-sm">Submitted Media</h4>
                    <p className="text-xs text-muted-foreground">Placeholder image submitted (or no media).</p>
                 </div>
               )}
              
              {selectedTaskForDetails.aiRisks && selectedTaskForDetails.aiRisks.length > 0 && (
                <div className="p-3 border rounded-md bg-destructive/10 border-destructive/50">
                  <h4 className="font-semibold text-sm flex items-center text-destructive"><AlertTriangle className="w-4 h-4 mr-2"/>AI Detected Risks</h4>
                  <ul className="list-disc list-inside text-sm text-destructive/90">
                    {selectedTaskForDetails.aiRisks.map((risk, i) => <li key={i}>{risk}</li>)}
                  </ul>
                  {selectedTaskForDetails.aiComplianceNotes && <p className="text-sm text-muted-foreground mt-1">AI Suggestion: {selectedTaskForDetails.aiComplianceNotes}</p>}
                </div>
              )}
              {selectedTaskForDetails.aiRisks && selectedTaskForDetails.aiRisks.length === 0 && (selectedTaskForDetails.status === 'completed' || selectedTaskForDetails.status === 'verified' || selectedTaskForDetails.status === 'needs-review') && (
                  <div className="p-3 border rounded-md bg-green-500/10 border-green-500/50">
                    <h4 className="font-semibold text-sm flex items-center text-green-700"><CheckCircle className="w-4 h-4 mr-2"/>AI Compliance</h4>
                    <p className="text-sm text-green-600">No compliance risks detected by AI.</p>
                  </div>
              )}
              {selectedTaskForDetails.supervisorReviewNotes && (
                <div className="p-3 border rounded-md bg-primary/10">
                  <h4 className="font-semibold text-sm">Supervisor Review Notes:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTaskForDetails.supervisorReviewNotes}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTaskDetailsDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
