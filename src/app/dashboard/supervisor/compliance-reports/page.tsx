
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Eye, RefreshCw, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import type { Task, TaskStatus } from '@/types/database';
import { fetchTasksForSupervisor, FetchTasksFilters } from '@/app/actions/supervisor/fetchTasks';
import { approveTaskBySupervisor, rejectTaskBySupervisor } from '@/app/actions/supervisor/reviewTask';
import { fetchUsersByRole, UserForSelection, FetchUsersByRoleResult } from '@/app/actions/common/fetchUsersByRole';
import { fetchSupervisorAssignedProjects, FetchSupervisorProjectsResult } from '@/app/actions/supervisor/fetchSupervisorData';
import { fetchAllProjects as fetchAllSystemProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { format } from 'date-fns';

export default function ComplianceReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasksForReviewList, setTasksForReviewList] = useState<Task[]>([]);
  const [processedTasksList, setProcessedTasksList] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [selectableProjectsList, setSelectableProjectsList] = useState<ProjectForSelection[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [isReviewingTask, setIsReviewingTask] = useState<Record<string, boolean>>({});

  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [taskToReject, setTaskToReject] = useState<Task | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const [showTaskDetailsDialog, setShowTaskDetailsDialog] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);

  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  const { toast } = useToast();

  const employeeMap = useMemo(() => new Map(employees.map(emp => [emp.id, emp])), [employees]);
  const projectMap = useMemo(() => new Map(selectableProjectsList.map(proj => [proj.id, proj])), [selectableProjectsList]);

  const loadReferenceData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingLookups(true);
    try {
      const projectsFetchAction = user.role === 'admin'
                                ? fetchAllSystemProjects()
                                : fetchSupervisorAssignedProjects(user.id);

      const [employeesResult, supervisorsResult, fetchedProjectsResult]: [FetchUsersByRoleResult, FetchUsersByRoleResult, FetchAllProjectsResult | FetchSupervisorProjectsResult] = await Promise.all([
        fetchUsersByRole('employee'),
        fetchUsersByRole('supervisor'),
        projectsFetchAction
      ]);
      
      let allUsers: UserForSelection[] = [];
      if (employeesResult.success && employeesResult.users) {
        allUsers = allUsers.concat(employeesResult.users);
      } else {
        console.error("Failed to fetch employees:", employeesResult.error);
      }

      if (supervisorsResult.success && supervisorsResult.users) {
        allUsers = allUsers.concat(supervisorsResult.users);
      } else {
        console.error("Failed to fetch supervisors:", supervisorsResult.error);
      }
      setEmployees(allUsers);


      if (fetchedProjectsResult.success && fetchedProjectsResult.projects) {
        setSelectableProjectsList(fetchedProjectsResult.projects);
      } else {
        setSelectableProjectsList([]);
        console.error("Failed to fetch projects:", fetchedProjectsResult.error);
      }
    } catch (error) {
      toast({ title: "Error fetching lookup data", description: "Could not load employees or projects.", variant: "destructive" });
      setEmployees([]);
      setSelectableProjectsList([]);
    } finally {
        setIsLoadingLookups(false);
    }
  }, [toast, user?.id, user?.role]);

  const loadData = useCallback(async () => {
    if (!user?.id || (!user.role || (user.role !== 'supervisor' && user.role !== 'admin'))) {
      if(!authLoading) toast({ title: "Authentication Error", description: "User not authorized.", variant: "destructive" });
      setIsLoadingData(false);
      return;
    }
    
    if (user.role === 'supervisor' && selectableProjectsList.length === 0 && !isLoadingLookups) {
        setTasksForReviewList([]);
        setProcessedTasksList([]);
        setIsLoadingData(false);
        return;
    }
    
    setIsLoadingData(true);
    try {
      const reviewResult = await fetchTasksForSupervisor(user.id, { status: 'needs-review' });
      if (reviewResult.success && reviewResult.tasks) {
        setTasksForReviewList(reviewResult.tasks);
      } else {
        toast({ title: "Error fetching review tasks", description: reviewResult.message || "Could not load tasks for review.", variant: "destructive" });
        setTasksForReviewList([]);
      }

      const [verifiedResult, rejectedResult] = await Promise.all([
        fetchTasksForSupervisor(user.id, { status: 'verified' }),
        fetchTasksForSupervisor(user.id, { status: 'rejected' })
      ]);
      
      let combinedProcessedTasks: Task[] = [];
      if (verifiedResult.success && verifiedResult.tasks) {
        combinedProcessedTasks = combinedProcessedTasks.concat(verifiedResult.tasks);
      } else {
         toast({ title: "Error fetching verified tasks", description: verifiedResult.message || "Could not load verified tasks.", variant: "destructive" });
      }
      if (rejectedResult.success && rejectedResult.tasks) {
        combinedProcessedTasks = combinedProcessedTasks.concat(rejectedResult.tasks);
      } else {
         toast({ title: "Error fetching rejected tasks", description: rejectedResult.message || "Could not load rejected tasks.", variant: "destructive" });
      }
      combinedProcessedTasks.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      setProcessedTasksList(combinedProcessedTasks);

    } catch (error) {
      toast({ title: "Error fetching tasks", description: "An unexpected error occurred.", variant: "destructive" });
      setTasksForReviewList([]);
      setProcessedTasksList([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, user?.id, user?.role, authLoading, selectableProjectsList, isLoadingLookups]);


  useEffect(() => { 
    if(user?.id && !authLoading){ 
        loadReferenceData();
    }
  }, [user?.id, authLoading, loadReferenceData]);

  useEffect(() => {
     if(user?.id && !authLoading && !isLoadingLookups){
        loadData();
     }
  }, [user?.id, authLoading, isLoadingLookups, loadData]);


  const handleApproveTask = async (taskId: string) => {
    if (!user) return;
    setIsReviewingTask(prev => ({...prev, [taskId]: true}));
    const result = await approveTaskBySupervisor({ taskId, supervisorId: user.id });
    if (result.success) {
      toast({ title: "Task Approved", description: `Task marked as ${result.updatedStatus}.` });
      loadData(); 
    } else {
      toast({ title: "Approval Failed", description: result.message, variant: "destructive" });
    }
    setIsReviewingTask(prev => ({...prev, [taskId]: false}));
  };

  const openRejectDialog = (task: Task) => {
    setTaskToReject(task);
    setRejectionReason(task.supervisorReviewNotes || "");
    setShowRejectionDialog(true);
  };

  const handleRejectTaskSubmit = async () => {
    if (!taskToReject || !user || !rejectionReason.trim()) {
      toast({ title: "Error", description: "Task or reason missing.", variant: "destructive"});
      return;
    }
    setIsReviewingTask(prev => ({...prev, [taskToReject.id]: true}));
    setShowRejectionDialog(false);
    const result = await rejectTaskBySupervisor({ taskId: taskToReject.id, supervisorId: user.id, rejectionReason });
    if (result.success) {
      toast({ title: "Task Rejected", description: `Task marked as ${result.updatedStatus}.` });
      loadData(); 
    } else {
      toast({ title: "Rejection Failed", description: result.message, variant: "destructive" });
    }
    setIsReviewingTask(prev => ({...prev, [(taskToReject as Task).id]: false}));
    setTaskToReject(null);
    setRejectionReason("");
  };
  
  const openDetailsDialog = (task: Task) => {
    setSelectedTaskForDetails(task);
    setShowTaskDetailsDialog(true);
  };
  
  const openImageModal = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImagePreviewModal(true);
  };

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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Task Compliance Reports" 
        description="Review task submissions for compliance, with AI-powered assistance."
        actions={<Button onClick={loadData} variant="outline" disabled={isLoadingData || isLoadingLookups || !user}><RefreshCw className={`mr-2 h-4 w-4 ${(isLoadingData || isLoadingLookups) ? 'animate-spin' : ''}`} /> Refresh Reports</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Submissions for Review</CardTitle>
          <CardDescription>Tasks flagged or pending compliance verification ({tasksForReviewList.length} items).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData || isLoadingLookups ? ( <div className="text-center py-4">Loading tasks for review...</div>) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>AI Insights</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksForReviewList.length === 0 && !(isLoadingData || isLoadingLookups) ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No tasks currently require compliance review.</TableCell></TableRow>
              ) : tasksForReviewList.map((task) => {
                const employee = employeeMap.get(task.assignedEmployeeId);
                const project = projectMap.get(task.projectId);
                const currentReviewingState = isReviewingTask[task.id] || false;
                return (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Image src={employee?.avatar || `https://placehold.co/32x32.png?text=${employee?.name?.substring(0,1)||"E"}`} alt={employee?.name || "Employee"} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                      <span className="font-medium">{employee?.name || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{task.taskName}</TableCell>
                  <TableCell>{project?.name || 'N/A'}</TableCell>
                  <TableCell>{task.endTime ? format(new Date(task.endTime), "PPp") : (task.updatedAt ? format(new Date(task.updatedAt), "PPp") : 'N/A')}</TableCell>
                  <TableCell>
                    {(task.aiRisks && task.aiRisks.length > 0) ? (
                      <div className="text-xs text-destructive">
                        <p className="flex items-center"><AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />Risks: {task.aiRisks.join(', ')}</p>
                        {task.aiComplianceNotes && <p className="mt-1">Note: {task.aiComplianceNotes}</p>}
                      </div>
                    ) : (
                      <div className="text-xs text-green-600 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                        {task.aiComplianceNotes || "No specific AI notes."}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                     <Button variant="ghost" size="icon" onClick={() => openDetailsDialog(task)} title="View Details" disabled={currentReviewingState}>
                        <Eye className="h-4 w-4" />
                     </Button>
                     <Button variant="outline" size="sm" onClick={() => openRejectDialog(task)} className="border-destructive text-destructive hover:bg-destructive/10" disabled={currentReviewingState}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                     </Button>
                     <Button size="sm" onClick={() => handleApproveTask(task.id)} className="bg-green-500 hover:bg-green-600 text-white" disabled={currentReviewingState}>
                        {currentReviewingState ? 'Processing...' : <><CheckCircle className="mr-1 h-4 w-4" /> Approve</>}
                     </Button>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Processed Compliance Reports</CardTitle>
          <CardDescription>{processedTasksList.length} items already reviewed or completed without issues.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData || isLoadingLookups ? ( <div className="text-center py-4">Loading processed tasks...</div>) : (
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead>Notes/AI Summary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
             {processedTasksList.length === 0 && !(isLoadingData || isLoadingLookups) ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No processed compliance reports found.</TableCell></TableRow>
             ) : processedTasksList.map((task) => {
                const employee = employeeMap.get(task.assignedEmployeeId);
                const project = projectMap.get(task.projectId);
                return (
                <TableRow key={task.id}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                         <Image src={employee?.avatar || `https://placehold.co/32x32.png?text=${employee?.name?.substring(0,1)||"E"}`} alt={employee?.name || "Employee"} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                        <span className="font-medium">{employee?.name || 'N/A'}</span>
                        </div>
                    </TableCell>
                    <TableCell>{task.taskName}</TableCell>
                    <TableCell>{project?.name || 'N/A'}</TableCell>
                    <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(task.status)}
                          className={getStatusBadgeClassName(task.status)}
                        >
                          {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                    </TableCell>
                    <TableCell>{task.reviewedAt ? format(new Date(task.reviewedAt), "PPp") : (task.endTime ? format(new Date(task.endTime), "PPp") : 'N/A')}</TableCell>
                    <TableCell className="text-xs">
                      {task.status === 'rejected' && task.supervisorReviewNotes && `Rejected: ${task.supervisorReviewNotes}`}
                      {task.status === 'verified' && task.supervisorReviewNotes && `Approved: ${task.supervisorReviewNotes}`}
                      {(task.status === 'completed' || task.status === 'verified') && (task.aiRisks?.length ? `AI Risks: ${task.aiRisks.join(', ')}` : "AI: No risks.")}
                      {(task.status === 'completed' || task.status === 'verified') && task.aiComplianceNotes && ` ${task.aiComplianceNotes}`}
                    </TableCell>
                    <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={() => openDetailsDialog(task)} title="View Details">
                            <Eye className="h-4 w-4" />
                         </Button>
                    </TableCell>
                </TableRow>
             )})}
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
              <DialogDescription>Provide a reason for rejecting this task. This will be visible to the employee.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="rejectionReasonCm">Rejection Reason</Label>
              <Textarea 
                id="rejectionReasonCm" 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                placeholder="e.g., Submitted media is unclear, task not fully completed..."
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
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
              <div className="flex items-center"><strong className="font-medium mr-2">Status:</strong> <Badge variant={getStatusBadgeVariant(selectedTaskForDetails.status)} className={getStatusBadgeClassName(selectedTaskForDetails.status)}>{selectedTaskForDetails.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge></div>
              <p><strong className="font-medium">Description:</strong> {selectedTaskForDetails.description || "N/A"}</p>
              {selectedTaskForDetails.dueDate && <p><strong className="font-medium">Due Date:</strong> {format(new Date(selectedTaskForDetails.dueDate), "PP")}</p>}
              {selectedTaskForDetails.supervisorNotes && <p><strong className="font-medium">Original Supervisor Notes:</strong> {selectedTaskForDetails.supervisorNotes}</p>}
              
              {selectedTaskForDetails.employeeNotes && (
                <Card><CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Employee/Session Notes</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTaskForDetails.employeeNotes}</p></CardContent></Card>
              )}
              
              {selectedTaskForDetails.submittedMediaUri && selectedTaskForDetails.submittedMediaUri !== "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" && (
                 <Card><CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Submitted Media (from Punch-out)</CardTitle></CardHeader><CardContent>
                    {selectedTaskForDetails.submittedMediaUri.startsWith('data:image') ? (
                        <Image 
                            src={selectedTaskForDetails.submittedMediaUri} 
                            alt="Submitted media" 
                            width={200} height={150} 
                            className="rounded-md mt-1 object-contain max-w-full cursor-pointer" 
                            data-ai-hint="task media"
                            onClick={() => openImageModal(selectedTaskForDetails.submittedMediaUri!)}
                        />
                    ) : ( <p className="text-xs text-muted-foreground">Media submitted (non-image or preview unavailable).</p> )}
                 </CardContent></Card>
               )}
               {selectedTaskForDetails.submittedMediaUri === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" && (
                  <Card><CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Submitted Media</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">Placeholder image submitted (or no media).</p></CardContent></Card>
               )}
              
              {(selectedTaskForDetails.aiRisks && selectedTaskForDetails.aiRisks.length > 0) || selectedTaskForDetails.aiComplianceNotes ? (
                <Card className={selectedTaskForDetails.aiRisks?.length ? "bg-destructive/10 border-destructive/50" : "bg-green-500/10 border-green-500/50"}>
                    <CardHeader className="pb-2 pt-4"><CardTitle className={`text-sm flex items-center ${selectedTaskForDetails.aiRisks?.length ? 'text-destructive' : 'text-green-700'}`}>
                        {selectedTaskForDetails.aiRisks?.length ? <AlertTriangle className="w-4 h-4 mr-2"/> : <CheckCircle className="w-4 h-4 mr-2"/>}
                        AI Compliance Check
                    </CardTitle></CardHeader>
                    <CardContent>
                  {selectedTaskForDetails.aiRisks && selectedTaskForDetails.aiRisks.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-destructive/90">
                      {selectedTaskForDetails.aiRisks.map((risk, i) => <li key={i}>{risk}</li>)}
                    </ul>
                  )}
                  {selectedTaskForDetails.aiComplianceNotes && <p className={`text-sm mt-1 ${selectedTaskForDetails.aiRisks?.length ? 'text-muted-foreground' : 'text-green-600'}`}>{selectedTaskForDetails.aiRisks?.length ? "AI Suggestion: " : ""}{selectedTaskForDetails.aiComplianceNotes}</p>}
                   {(!selectedTaskForDetails.aiRisks || selectedTaskForDetails.aiRisks.length === 0) && !selectedTaskForDetails.aiComplianceNotes && <p className="text-sm text-green-600">No compliance risks or specific notes from AI.</p>}
                </CardContent></Card>
              ): null}
              
              {selectedTaskForDetails.supervisorReviewNotes && (
                 <Card className={selectedTaskForDetails.status === 'rejected' ? "bg-destructive/10" : "bg-primary/10"}><CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Supervisor Review Notes:</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTaskForDetails.supervisorReviewNotes}</p></CardContent></Card>
              )}
              {selectedTaskForDetails.reviewedBy && <p className="text-xs text-muted-foreground">Reviewed by: {employeeMap.get(selectedTaskForDetails.reviewedBy)?.name || selectedTaskForDetails.reviewedBy} at {selectedTaskForDetails.reviewedAt ? format(new Date(selectedTaskForDetails.reviewedAt), 'PPpp') : 'N/A'}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTaskDetailsDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Modal */}
      <Dialog open={showImagePreviewModal} onOpenChange={(isOpen) => { if(!isOpen) setModalImageUrl(null); setShowImagePreviewModal(isOpen);}}>
        <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {modalImageUrl && (
            <div className="relative w-full aspect-square max-h-[80vh]">
              <Image 
                src={modalImageUrl} 
                alt="Submitted Media Preview" 
                layout="fill"
                objectFit="contain"
                data-ai-hint="media preview"
              />
            </div>
          )}
          <DialogFooter className="pt-2 pr-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
