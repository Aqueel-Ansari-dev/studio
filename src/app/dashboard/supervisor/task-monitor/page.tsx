
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Search, RefreshCw, CheckCircle, XCircle, MessageSquare, AlertTriangle, Eye, ChevronDown, User, CalendarIcon, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import type { Task, TaskStatus } from '@/types/database';
import { fetchTasksForSupervisor, FetchTasksFilters, FetchTasksResult } from '@/app/actions/supervisor/fetchTasks';
import { approveTaskBySupervisor, rejectTaskBySupervisor } from '@/app/actions/supervisor/reviewTask';
import { assignTasksToEmployee, AssignTasksInput, AssignTasksResult } from '@/app/actions/admin/assignTask';
import { fetchUsersByRole, UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchSupervisorAssignedProjects } from '@/app/actions/supervisor/fetchSupervisorData';
import { fetchAllProjects as fetchAllSystemProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const TASK_PAGE_LIMIT = 15;

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
      case 'in-progress': return 'bg-blue-500 text-white';
      case 'paused': return 'border-orange-500 text-orange-600';
      default: return '';
    }
};

export default function TaskMonitorPage() {
  const { user, loading: authLoading } = useAuth();
  const [allFetchedTasks, setAllFetchedTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [selectableProjectsList, setSelectableProjectsList] = useState<ProjectForSelection[]>([]);
  
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastTaskCursor, setLastTaskCursor] = useState<{ updatedAt: string; createdAt: string } | null | undefined>(undefined);
  const [hasMoreTasks, setHasMoreTasks] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all"); 
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all" | "unassigned">("all");
  const { toast } = useToast();

  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [taskToManage, setTaskToManage] = useState<Task | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [showTaskDetailsSheet, setShowTaskDetailsSheet] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({ employeeId: '', dueDate: undefined as Date | undefined, notes: ''});

  const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp])), [employees]);
  const projectMap = useMemo(() => new Map(selectableProjectsList.map(proj => [proj.id, proj.name])), [selectableProjectsList]);

  const loadLookups = useCallback(async (userId: string) => {
    if (!userId) return;
    setIsLoadingLookups(true);
    try {
      const projectsFetchAction = user?.role === 'admin' 
                                ? fetchAllSystemProjects(userId)
                                : fetchSupervisorAssignedProjects(userId);

      const [fetchedEmployeesResult, fetchedProjectsResult] = await Promise.all([
        fetchUsersByRole(userId, 'employee'),
        projectsFetchAction
      ]);

      if (fetchedEmployeesResult.success && fetchedEmployeesResult.users) setEmployees(fetchedEmployeesResult.users);
      else {
        setEmployees([]);
        console.error("Error fetching employees:", fetchedEmployeesResult.error);
      }

      if (fetchedProjectsResult.success && fetchedProjectsResult.projects) {
        setSelectableProjectsList(fetchedProjectsResult.projects);
      } else {
        setSelectableProjectsList([]);
        console.error(`Error fetching projects for ${user?.role}:`, fetchedProjectsResult.error);
      }
    } catch (error) {
      setEmployees([]);
      setSelectableProjectsList([]);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [user?.role]);
  
  const loadTasks = useCallback(async (loadMore = false) => {
    if (!user?.id || authLoading || isLoadingLookups) return;
    
    if (user.role === 'supervisor' && selectableProjectsList.length === 0) {
        setAllFetchedTasks([]);
        setHasMoreTasks(false);
        setIsLoadingTasks(false);
        setIsLoadingMore(false);
        return;
    }

    if (!loadMore) {
      setIsLoadingTasks(true);
      setLastTaskCursor(undefined);
      setHasMoreTasks(true);
    } else {
      if (!hasMoreTasks || lastTaskCursor === null) return; 
      setIsLoadingMore(true);
    }

    const filters: FetchTasksFilters = {};
    if (statusFilter !== "all") filters.status = statusFilter;
    if (projectFilter !== "all") filters.projectId = projectFilter;

    const cursor = loadMore ? lastTaskCursor : undefined;
    const result: FetchTasksResult = await fetchTasksForSupervisor(user.id, filters, TASK_PAGE_LIMIT, cursor);

    if (result.success && result.tasks) {
      if (loadMore) {
        setAllFetchedTasks(prev => [...prev, ...result.tasks!]);
      } else {
        setAllFetchedTasks(result.tasks!);
      }
      setLastTaskCursor(result.lastVisibleTaskTimestamps);
      setHasMoreTasks(result.hasMore || false);
    } else {
      if (!loadMore) setAllFetchedTasks([]);
      setHasMoreTasks(false);
      toast({ title: "Error", description: result.message || "Could not load tasks.", variant: "destructive" });
    }
    if (!loadMore) setIsLoadingTasks(false); else setIsLoadingMore(false);
  }, [user, authLoading, isLoadingLookups, toast, statusFilter, projectFilter, selectableProjectsList, hasMoreTasks, lastTaskCursor]); 

  useEffect(() => {
    if (user?.id && !authLoading) {
      loadLookups(user.id);
    }
  }, [user?.id, authLoading, loadLookups]); 

  useEffect(() => {
    if (user?.id && !authLoading && !isLoadingLookups) {
      loadTasks(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, isLoadingLookups, statusFilter, projectFilter]);

  const handleApproveTask = async (taskId: string) => {
    if (!user?.id) return; 
    setIsProcessing(prev => ({...prev, [taskId]: true}));
    const result = await approveTaskBySupervisor({ taskId, supervisorId: user.id });
    if (result.success) {
      toast({ title: "Task Approved", description: result.message });
      loadTasks(false); 
    } else {
      toast({ title: "Approval Failed", description: result.message, variant: "destructive" });
    }
    setIsProcessing(prev => ({...prev, [taskId]: false}));
  };

  const openRejectDialog = (task: Task) => {
    setTaskToManage(task);
    setRejectionReason(task.supervisorReviewNotes || ""); 
    setShowRejectionDialog(true);
  };

  const handleRejectTaskSubmit = async () => {
    if (!taskToManage || !user?.id || !rejectionReason.trim()) { 
      toast({ title: "Error", description: "Task or reason missing for rejection.", variant: "destructive"});
      return;
    }
    setIsProcessing(prev => ({...prev, [taskToManage.id]: true}));
    setShowRejectionDialog(false);
    const result = await rejectTaskBySupervisor({ taskId: taskToManage.id, supervisorId: user.id, rejectionReason });
    if (result.success) {
      toast({ title: "Task Rejected", description: result.message });
      loadTasks(false); 
    } else {
      toast({ title: "Rejection Failed", description: result.message, variant: "destructive" });
    }
    setTaskToManage(null);
    setRejectionReason("");
    setIsProcessing(prev => ({...prev, [(taskToManage as Task).id]: false}));
  };
  
  const openDetailsSheet = (task: Task) => {
    setSelectedTaskForDetails(task);
    setShowTaskDetailsSheet(true);
  };

  const openAssignDialog = (task: Task) => {
    setTaskToManage(task);
    setAssignForm({ employeeId: '', dueDate: undefined, notes: '' });
    setShowAssignDialog(true);
  };

  const handleAssignSubmit = async () => {
    if (!user?.id || !taskToManage || !assignForm.employeeId || !assignForm.dueDate) {
        toast({ title: "Missing Fields", description: "Please select an employee and set a due date.", variant: "destructive" });
        return;
    }
    setIsProcessing(prev => ({...prev, [taskToManage.id]: true}));
    const input: AssignTasksInput = {
        existingTasksToAssign: [{ taskId: taskToManage.id, isImportant: taskToManage.isImportant || false }],
        employeeId: assignForm.employeeId,
        projectId: taskToManage.projectId,
        dueDate: assignForm.dueDate,
        supervisorNotes: assignForm.notes
    };
    const result: AssignTasksResult = await assignTasksToEmployee(user.id, input);
    if (result.success) {
        toast({ title: "Task Assigned", description: result.message });
        setShowAssignDialog(false);
        setTaskToManage(null);
        loadTasks(false);
    } else {
        toast({ title: "Assignment Failed", description: result.message, variant: "destructive" });
    }
    setIsProcessing(prev => ({...prev, [(taskToManage as Task).id]: false}));
  };

  const filteredAndSearchedTasks = useMemo(() => allFetchedTasks.filter(task => {
    const employeeName = employeeMap.get(task.assignedEmployeeId)?.name || "unassigned";
    const projectName = projectMap.get(task.projectId) || "";
    const taskName = task.taskName || "";
    const searchLower = searchTerm.toLowerCase();
    return (
      taskName.toLowerCase().includes(searchLower) ||
      employeeName.toLowerCase().includes(searchLower) ||
      projectName.toLowerCase().includes(searchLower)
    );
  }), [allFetchedTasks, employeeMap, projectMap, searchTerm]);
  
  const taskStatuses: (TaskStatus | "all" | "unassigned")[] = ["all", "unassigned", "pending", "in-progress", "paused", "completed", "needs-review", "verified", "rejected"];
  const isLoading = isLoadingTasks || isLoadingLookups || authLoading;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Task Monitor" 
        description="Oversee and track the status of all tasks. Review tasks and assign unassigned work."
        actions={<Button onClick={() => loadTasks(false)} variant="outline" disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoadingTasks && !isLoadingMore ? 'animate-spin' : ''}`} /> Refresh Tasks</Button>}
      />

      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
                placeholder="Search loaded tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:col-span-1"
                disabled={isLoading}
              />
            <Select value={projectFilter} onValueChange={setProjectFilter} disabled={isLoading || selectableProjectsList.length === 0}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{user?.role === 'admin' ? 'All System Projects' : 'All Assigned Projects'}</SelectItem>
                {selectableProjectsList.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)} disabled={isLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taskStatuses.map(status => <SelectItem key={status} value={status}>{status === "all" ? "All Statuses" : status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && filteredAndSearchedTasks.length === 0 ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading data...</p>
            </div>
          ) : (
            <>
            <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Task</TableHead><TableHead>Project</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredAndSearchedTasks.length > 0 ? filteredAndSearchedTasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell>{task.assignedEmployeeId && employeeMap.get(task.assignedEmployeeId) ? <div className="flex items-center gap-2"><Image src={employeeMap.get(task.assignedEmployeeId)?.avatar || ''} alt={employeeMap.get(task.assignedEmployeeId)?.name || ''} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/><span className="font-medium">{employeeMap.get(task.assignedEmployeeId)?.name}</span></div> : <Button variant="outline" size="sm" onClick={() => openAssignDialog(task)} disabled={isProcessing[task.id]}>Assign</Button>}</TableCell>
                    <TableCell>{task.taskName}</TableCell>
                    <TableCell>{projectMap.get(task.projectId) || task.projectId}</TableCell>
                    <TableCell>{task.dueDate ? format(new Date(task.dueDate as string), "PP") : 'N/A'}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(task.status)} className={getStatusBadgeClassName(task.status)}>{task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetailsSheet(task)} title="View Details" disabled={isProcessing[task.id]}><Eye className="h-4 w-4" /></Button>
                      {task.status === 'needs-review' && (<><Button variant="outline" size="sm" onClick={() => openRejectDialog(task)} className="border-destructive text-destructive" disabled={isProcessing[task.id]}><XCircle className="mr-1 h-4 w-4" /> Reject</Button><Button size="sm" onClick={() => handleApproveTask(task.id)} className="bg-green-500 hover:bg-green-600 text-white" disabled={isProcessing[task.id]}>{isProcessing[task.id] ? '...' : <><CheckCircle className="mr-1 h-4 w-4" /> Approve</>}</Button></>)}
                    </TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No tasks match the current filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
            <div className="md:hidden space-y-3">
              {filteredAndSearchedTasks.length > 0 ? filteredAndSearchedTasks.map(task => (
                <Card key={task.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{task.taskName}</p>
                      <p className="text-sm text-muted-foreground">{projectMap.get(task.projectId) || 'Unknown Project'}</p>
                    </div>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => openDetailsSheet(task)}>View Details</DropdownMenuItem>{task.status === 'needs-review' && <><DropdownMenuItem onSelect={() => openRejectDialog(task)} className="text-destructive">Reject</DropdownMenuItem><DropdownMenuItem onSelect={() => handleApproveTask(task.id)}>Approve</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    {task.assignedEmployeeId && employeeMap.get(task.assignedEmployeeId) ? <div className="flex items-center gap-2"><Image src={employeeMap.get(task.assignedEmployeeId)?.avatar || ''} alt={employeeMap.get(task.assignedEmployeeId)?.name || ''} width={24} height={24} className="rounded-full" data-ai-hint="employee avatar"/><span className="text-sm">{employeeMap.get(task.assignedEmployeeId)?.name}</span></div> : <Button variant="outline" size="sm" onClick={() => openAssignDialog(task)} disabled={isProcessing[task.id]}>Assign</Button>}
                    <Badge variant={getStatusBadgeVariant(task.status)} className={getStatusBadgeClassName(task.status)}>{task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                  </div>
                </Card>
              )) : <p className="text-center text-muted-foreground">No tasks match the current filters.</p>}
            </div>
            {hasMoreTasks && <div className="mt-6 text-center"><Button onClick={() => loadTasks(true)} disabled={isLoadingMore || isLoadingTasks}>{isLoadingMore ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ChevronDown className="mr-2 h-4 w-4"/>} Load More Tasks</Button></div>}
            </>
          )}
        </CardContent>
      </Card>

      {taskToManage && showAssignDialog && <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}><DialogContent><DialogHeader><DialogTitle>Assign Task: {taskToManage.taskName}</DialogTitle><DialogDescription>Select an employee and set a due date for this task.</DialogDescription></DialogHeader><div className="py-4 space-y-4"><div><Label htmlFor="assign-employee">Employee</Label><Select value={assignForm.employeeId} onValueChange={(v) => setAssignForm(p => ({...p, employeeId: v}))}><SelectTrigger id="assign-employee"><SelectValue placeholder="Select an employee" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="assign-dueDate">Due Date</Label><Popover><PopoverTrigger asChild><Button id="assign-dueDate" variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{assignForm.dueDate ? format(assignForm.dueDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={assignForm.dueDate} onSelect={(d) => setAssignForm(p => ({...p, dueDate: d}))} initialFocus /></PopoverContent></Popover></div><div><Label htmlFor="assign-notes">Supervisor Notes (Optional)</Label><Textarea id="assign-notes" placeholder="Add specific notes..." value={assignForm.notes} onChange={e => setAssignForm(p => ({...p, notes: e.target.value}))}/></div></div><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleAssignSubmit} disabled={!assignForm.employeeId || !assignForm.dueDate || isProcessing[taskToManage.id]}>{isProcessing[taskToManage.id] ? "Assigning..." : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>}
      {taskToManage && showRejectionDialog && <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}><DialogContent><DialogHeader><DialogTitle>Reject Task: {taskToManage.taskName}</DialogTitle><DialogDescription>Provide a reason for rejecting this task.</DialogDescription></DialogHeader><div className="py-4 space-y-2"><Label htmlFor="rejectionReason">Rejection Reason</Label><Textarea id="rejectionReason" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="e.g., Media unclear..." minLength={5}/></div><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleRejectTaskSubmit} variant="destructive" disabled={!rejectionReason.trim() || isProcessing[taskToManage.id]}>{isProcessing[taskToManage.id] ? "Rejecting..." : "Submit Rejection"}</Button></DialogFooter></DialogContent></Dialog>}
      {selectedTaskForDetails && <Sheet open={showTaskDetailsSheet} onOpenChange={setShowTaskDetailsSheet}><SheetContent className="sm:max-w-lg"><SheetHeader><SheetTitle>Task Details: {selectedTaskForDetails.taskName}</SheetTitle><SheetDescription>Assigned to: {employeeMap.get(selectedTaskForDetails.assignedEmployeeId)?.name || 'Unassigned'}</SheetDescription></SheetHeader><div className="py-4 space-y-4"><p><strong>Status:</strong> {selectedTaskForDetails.status}</p><p><strong>Description:</strong> {selectedTaskForDetails.description || "N/A"}</p>{selectedTaskForDetails.employeeNotes && <div className="p-2 border rounded bg-muted/50"><p className="font-semibold text-sm">Employee Notes:</p><p className="text-sm text-muted-foreground">{selectedTaskForDetails.employeeNotes}</p></div>}</div><SheetFooter><Button onClick={() => setShowTaskDetailsSheet(false)}>Close</Button></SheetFooter></SheetContent></Sheet>}
    </div>
  );
}
