
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogTrigger, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider, TooltipContent } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, RefreshCw, Edit, Trash2, Eye, CalendarIcon, DollarSign, ChevronDown, Check, ChevronsUpDown, CheckCircle, XCircle, CircleSlash, AlertTriangle, MoreVertical, Clock, Users, Rows3, KanbanSquare, ChevronLeft, ChevronRight } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { format, isPast, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchProjectsForAdmin, type ProjectForAdminList } from '@/app/actions/admin/fetchProjectsForAdmin';
import { countProjects } from '@/app/actions/admin/countProjects';
import { fetchAllProjectsForBoard } from '@/app/actions/admin/fetchAllProjectsForBoard';
import { createProject, type CreateProjectInput, type CreateProjectResult } from '@/app/actions/admin/createProject';
import { deleteProjectByAdmin, type DeleteProjectResult } from '@/app/actions/admin/deleteProject';
import { updateProjectByAdmin, type UpdateProjectInput, type UpdateProjectResult } from '@/app/actions/admin/updateProject';
import { createQuickTaskForAssignment, type CreateQuickTaskInput, type CreateQuickTaskResult } from '@/app/actions/supervisor/createTask';
import { fetchUsersByRole, type UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { resetAllTransactionalData } from '@/app/actions/admin/resetProjectData';
import { deleteAllUsers } from '@/app/actions/admin/deleteAllUsers';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ProjectStatus, PredefinedTask } from '@/types/database';
import { ProjectKanbanBoard } from '@/components/admin/ProjectKanbanBoard';

const projectStatusOptions: ProjectStatus[] = ['active', 'paused', 'completed', 'inactive'];

interface TaskToCreate {
  id: string; 
  name: string;
  description: string;
}

const formatCurrency = (amount: number | undefined | null, defaultToZero: boolean = true): string => {
  if (typeof amount !== 'number' || isNaN(amount) || amount === null) {
      return defaultToZero ? '$0.00' : 'N/A';
  }
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

export default function ProjectManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [boardProjects, setBoardProjects] = useState<ProjectForAdminList[]>([]);
  const [listProjects, setListProjects] = useState<ProjectForAdminList[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalProjects, setTotalProjects] = useState(0);
  const totalPages = Math.ceil(totalProjects / pageSize);
  const startRange = totalProjects > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRange = Math.min(currentPage * pageSize, totalProjects);
  
  const [availableSupervisors, setAvailableSupervisors] = useState<UserForSelection[]>([]);
  const [predefinedTasks, setPredefinedTasks] = useState<PredefinedTask[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);

  // Dialogs and Forms State
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectImageUrl, setNewProjectImageUrl] = useState('');
  const [newProjectDataAiHint, setNewProjectDataAiHint] = useState('');
  const [newProjectClientInfo, setNewProjectClientInfo] = useState('');
  const [newProjectDueDate, setNewProjectDueDate] = useState<Date | undefined>(undefined);
  const [newProjectBudget, setNewProjectBudget] = useState<string>('');
  const [newProjectSelectedSupervisorIds, setNewProjectSelectedSupervisorIds] = useState<string[]>([]);
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [showTaskCreationStep, setShowTaskCreationStep] = useState(false);
  const [currentProjectIdForTaskCreation, setCurrentProjectIdForTaskCreation] = useState<string | null>(null);
  const [currentProjectNameForTaskCreation, setCurrentProjectNameForTaskCreation] = useState<string>('');
  const [tasksToCreate, setTasksToCreate] = useState<TaskToCreate[]>([{ id: crypto.randomUUID(), name: '', description: '' }]);
  const [isSubmittingTasks, setIsSubmittingTasks] = useState(false);
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectForAdminList | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [editProjectImageUrl, setEditProjectImageUrl] = useState('');
  const [editProjectDataAiHint, setEditProjectDataAiHint] = useState('');
  const [editProjectClientInfo, setEditProjectClientInfo] = useState('');
  const [editProjectDueDate, setEditProjectDueDate] = useState<Date | undefined | null>(undefined);
  const [editProjectBudget, setEditProjectBudget] = useState<string>('');
  const [editProjectSelectedSupervisorIds, setEditProjectSelectedSupervisorIds] = useState<string[]>([]);
  const [editProjectStatus, setEditProjectStatus] = useState<ProjectStatus>('active');
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectForAdminList | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingProjects, setIsResettingProjects] = useState(false);
  const [isDeletingAllUsers, setIsDeletingAllUsers] = useState(false);
  const [devActionConfirmInput, setDevActionConfirmInput] = useState('');

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [supervisorResult, predefinedTasksResult] = await Promise.all([
        fetchUsersByRole('supervisor'),
        fetchPredefinedTasks()
      ]);
      
      if (supervisorResult.success && supervisorResult.users) {
        setAvailableSupervisors(supervisorResult.users);
      } else {
        toast({ title: "Error", description: supervisorResult.error || "Could not load supervisor list.", variant: "destructive" });
        setAvailableSupervisors([]); 
      }
      
      if (predefinedTasksResult.success && predefinedTasksResult.tasks) {
        setPredefinedTasks(predefinedTasksResult.tasks);
      } else {
        console.warn("Could not load predefined tasks:", predefinedTasksResult.error);
        setPredefinedTasks([]);
      }

    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred while loading lookup data.", variant: "destructive" });
      setAvailableSupervisors([]);
      setPredefinedTasks([]);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);

  const loadDataForPage = useCallback(async (page: number, size: number) => {
    if (!user?.id) return;
    setIsLoading(true);

    if (viewMode === 'list') {
      // For list view, we fetch total count only if it's not set yet.
      if (totalProjects === 0) {
        const countRes = await countProjects();
        if (countRes.success && typeof countRes.count === 'number') {
          setTotalProjects(countRes.count);
        } else {
          toast({ title: "Error", description: countRes.error || "Could not get project count." });
        }
      }
      
      const projectsRes = await fetchProjectsForAdmin(page, size);
      if (projectsRes.success && projectsRes.projects) {
        setListProjects(projectsRes.projects);
      } else {
        toast({ title: "Error", description: projectsRes.error || "Could not fetch projects." });
      }
    } else { // 'board' view
      const result = await fetchAllProjectsForBoard();
      if (result.success && result.projects) {
        setBoardProjects(result.projects);
      } else {
        toast({ title: "Error Loading Board", description: result.error, variant: "destructive" });
      }
    }
    setIsLoading(false);
  }, [user?.id, viewMode, toast, totalProjects]);


  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
      loadDataForPage(newPage, pageSize);
    }
  };
  
  const handlePageSizeChange = (newSize: number) => {
      setPageSize(newSize);
      setCurrentPage(1); // Reset to first page
      loadDataForPage(1, newSize);
  };

  useEffect(() => {
    if (user?.id) {
     loadDataForPage(currentPage, pageSize);
     if (isLoadingLookups) loadLookups();
    }
  }, [user?.id, viewMode, loadDataForPage, isLoadingLookups, loadLookups, currentPage, pageSize]);

  const refreshData = () => {
    loadDataForPage(currentPage, pageSize);
  };
  
  const resetAddForm = () => {
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectImageUrl('');
    setNewProjectDataAiHint('');
    setNewProjectClientInfo('');
    setNewProjectDueDate(undefined);
    setNewProjectBudget('');
    setNewProjectSelectedSupervisorIds([]);
    setAddFormErrors({});
    setShowTaskCreationStep(false);
    setCurrentProjectIdForTaskCreation(null);
    setCurrentProjectNameForTaskCreation('');
    setTasksToCreate([{ id: crypto.randomUUID(), name: '', description: '' }]);
  }

  const handleAddProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }
    setIsSubmittingProject(true);
    setAddFormErrors({});
    
    const projectInput: CreateProjectInput = {
      name: newProjectName,
      description: newProjectDescription,
      imageUrl: newProjectImageUrl,
      dataAiHint: newProjectDataAiHint,
      clientInfo: newProjectClientInfo,
      dueDate: newProjectDueDate || null,
      budget: newProjectBudget ? parseFloat(newProjectBudget) : null,
      assignedSupervisorIds: newProjectSelectedSupervisorIds,
    };

    const result: CreateProjectResult = await createProject(user.id, projectInput);

    if (result.success && result.projectId) {
      toast({
        title: "Project Created!",
        description: `Project "${newProjectName}" has been successfully created. Now add tasks.`,
      });
      setCurrentProjectIdForTaskCreation(result.projectId);
      setCurrentProjectNameForTaskCreation(newProjectName);
      setShowTaskCreationStep(true);
    } else {
      if (result.errors) {
        const newErrors: Record<string, string | undefined> = {};
        result.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
        setAddFormErrors(newErrors);
      }
      toast({
        title: result.errors ? "Validation Failed" : "Creation Failed",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsSubmittingProject(false);
  };
  
  const handleNewTaskNameChange = (index: number, value: string) => {
    setTasksToCreate(prev => prev.map((task, i) => i === index ? { ...task, name: value } : task));
  };
  
  const handleTaskDescriptionChange = (index: number, value: string) => {
    setTasksToCreate(prev => prev.map((task, i) => i === index ? { ...task, description: value } : task));
  };
  
  const handleSelectPredefinedTask = (index: number, predefinedTask: PredefinedTask) => {
    setTasksToCreate(prev => prev.map((task, i) => i === index ? { ...task, name: predefinedTask.name, description: predefinedTask.description } : task));
  };

  const handleAddTaskRow = () => {
    setTasksToCreate([...tasksToCreate, { id: crypto.randomUUID(), name: '', description: '' }]);
  };

  const handleRemoveTaskRow = (index: number) => {
    if (tasksToCreate.length > 1) {
      const newTasks = tasksToCreate.filter((_, i) => i !== index);
      setTasksToCreate(newTasks);
    }
  };

  const handleSubmitTasksAndFinish = async () => {
    if (!user || !currentProjectIdForTaskCreation) return;
    setIsSubmittingTasks(true);
    let tasksCreatedCount = 0;
    let tasksFailedCount = 0;

    for (const task of tasksToCreate) {
      if (task.name.trim() === '') continue; 

      const taskInput: CreateQuickTaskInput = {
        projectId: currentProjectIdForTaskCreation,
        taskName: task.name,
        description: task.description,
        isImportant: false, 
      };
      const taskResult: CreateQuickTaskResult = await createQuickTaskForAssignment(user.id, taskInput);
      if (taskResult.success) {
        tasksCreatedCount++;
      } else {
        tasksFailedCount++;
        toast({ title: `Failed to create task "${task.name}"`, description: taskResult.message, variant: "destructive" });
      }
    }

    toast({
      title: "Task Creation Complete",
      description: `${tasksCreatedCount} task(s) created. ${tasksFailedCount > 0 ? tasksFailedCount + ' failed.' : ''}`,
    });
    
    finishProjectAndTaskCreation();
  };
  
  const finishProjectAndTaskCreation = () => {
    resetAddForm();
    setShowAddProjectDialog(false);
    refreshData(); 
    setIsSubmittingTasks(false);
  }

  const handleOpenEditDialog = (project: ProjectForAdminList) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectDescription(project.description || '');
    setEditProjectImageUrl(project.imageUrl || '');
    setEditProjectDataAiHint(project.dataAiHint || '');
    setEditProjectClientInfo(project.clientInfo || '');
    setEditProjectDueDate(project.dueDate ? new Date(project.dueDate) : null);
    setEditProjectBudget(project.budget ? String(project.budget) : '');
    setEditProjectSelectedSupervisorIds(project.assignedSupervisorIds || []);
    setEditProjectStatus(project.status || 'active');
    setEditFormErrors({});
    setShowEditProjectDialog(true);
  };

  const handleEditProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingProject) return;
    setIsSubmittingEdit(true);
    setEditFormErrors({});
    
    const updateInput: UpdateProjectInput = {
        name: editProjectName,
        description: editProjectDescription,
        imageUrl: editProjectImageUrl,
        dataAiHint: editProjectDataAiHint,
        clientInfo: editProjectClientInfo,
        dueDate: editProjectDueDate,
        budget: editProjectBudget && editProjectBudget.trim() !== '' ? parseFloat(editProjectBudget) : null,
        assignedSupervisorIds: editProjectSelectedSupervisorIds,
        status: editProjectStatus,
    };
    
    const result: UpdateProjectResult = await updateProjectByAdmin(user.id, editingProject.id, updateInput);

    if (result.success) {
        toast({ title: "Project Updated", description: result.message });
        setShowEditProjectDialog(false);
        setEditingProject(null);
        refreshData(); 
    } else {
        if (result.errors) {
            const newErrors: Record<string, string | undefined> = {};
            result.errors.forEach(err => { newErrors[err.path[0] as string] = err.message; });
            setEditFormErrors(newErrors);
        }
        toast({ title: result.errors ? "Validation Failed" : "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmittingEdit(false);
  };

  const handleOpenDeleteDialog = (project: ProjectForAdminList) => {
    setProjectToDelete(project);
    setShowDeleteProjectDialog(true);
    setDeleteConfirmInput("");
  };

  const handleDeleteProjectConfirm = async () => {
    if (!user || !projectToDelete) return;
    if (deleteConfirmInput !== projectToDelete.name) {
        toast({ title: "Confirmation Failed", description: "The project name you entered does not match.", variant: "destructive"});
        return;
    }
    setIsDeleting(true);
    const result: DeleteProjectResult = await deleteProjectByAdmin(user.id, projectToDelete.id);
    if (result.success) {
      toast({ title: "Project Deleted", description: result.message });
      refreshData(); 
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setShowDeleteProjectDialog(false);
    setProjectToDelete(null);
    setIsDeleting(false);
  };

  const handleResetAllData = async () => {
    if (!user) return;
    setIsResettingProjects(true);
    const result = await resetAllTransactionalData(user.id);
    if (result.success) {
        toast({
            title: "All Transactional Data Deleted",
            description: result.message,
            duration: 9000,
        });
        refreshData(); 
    } else {
        toast({
            title: "Deletion Failed",
            description: result.message,
            variant: "destructive",
        });
    }
    setIsResettingProjects(false);
    setDevActionConfirmInput('');
  };

  const handleDeleteAllUsers = async () => {
    if (!user) return;
    setIsDeletingAllUsers(true);
    const result = await deleteAllUsers(user.id);
    if (result.success) {
        toast({
            title: "All Users Deleted",
            description: result.message,
            duration: 9000,
        });
        refreshData(); // Reload data as user assignments will change
    } else {
        toast({
            title: "User Deletion Failed",
            description: result.message,
            variant: "destructive",
        });
    }
    setIsDeletingAllUsers(false);
    setDevActionConfirmInput('');
  };

  const SupervisorMultiSelect = ({ 
    selectedIds, 
    setSelectedIds, 
    availableSupervisors,
    isLoading,
    placeholder = "Select supervisors"
  }: { 
    selectedIds: string[], 
    setSelectedIds: (ids: string[]) => void, 
    availableSupervisors: UserForSelection[],
    isLoading: boolean,
    placeholder?: string
  }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (supervisorId: string) => {
      setSelectedIds(
        selectedIds.includes(supervisorId)
          ? selectedIds.filter(id => id !== supervisorId)
          : [...selectedIds, supervisorId]
      );
    };
    
    const selectedSupervisorsText = availableSupervisors
      .filter(s => selectedIds.includes(s.id))
      .map(s => s.name)
      .join(", ");

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">
              {selectedSupervisorsText || (isLoading ? "Loading supervisors..." : (availableSupervisors.length === 0 ? "No supervisors available" : placeholder))}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <ScrollArea className="max-h-60">
                <div className="p-2 space-y-1">
                    {availableSupervisors.map((supervisor) => (
                        <div
                        key={supervisor.id}
                        className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => handleSelect(supervisor.id)}
                        >
                        <Checkbox
                            id={`supervisor-checkbox-${supervisor.id}`}
                            checked={selectedIds.includes(supervisor.id)}
                            onCheckedChange={() => handleSelect(supervisor.id)}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <Label
                            htmlFor={`supervisor-checkbox-${supervisor.id}`}
                            className="font-normal cursor-pointer flex-grow"
                        >
                            {supervisor.name}
                        </Label>
                        </div>
                    ))}
                    {availableSupervisors.length === 0 && !isLoading && (
                        <div className="py-6 text-center text-sm text-muted-foreground">No supervisors found. Create supervisor users first.</div>
                    )}
                </div>
            </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };

  const getProjectStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'active':
        return <Badge style={{backgroundColor: "hsl(var(--status-active))"}} className="text-white hover:bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Active</Badge>;
      case 'paused':
        return <Badge style={{backgroundColor: "hsl(var(--status-paused))"}} className="text-white hover:bg-amber-600"><Clock className="mr-1 h-3 w-3" />Paused</Badge>;
      case 'completed':
        return <Badge style={{backgroundColor: "hsl(var(--status-completed))"}} className="text-white hover:bg-blue-600"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      case 'inactive':
        return <Badge style={{backgroundColor: "hsl(var(--status-inactive))"}} className="text-white hover:bg-gray-600"><CircleSlash className="mr-1 h-3 w-3" />Inactive</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const pageActions = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={refreshData} disabled={isLoading} className="mr-2">
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
      <Dialog open={showAddProjectDialog} onOpenChange={(isOpen) => {
          if (!isOpen) resetAddForm(); 
          setShowAddProjectDialog(isOpen);
      }}>
        <DialogTrigger asChild>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Project
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col">
          {!showTaskCreationStep ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline">Add New Project</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new project. Fields with <span className="text-destructive">*</span> are required.
                </DialogDescription>
              </DialogHeader>
              <form id="addProjectForm" onSubmit={handleAddProjectSubmit} className="space-y-4 py-4 overflow-y-auto px-1 flex-grow">
                <div>
                  <Label htmlFor="newProjectName">Project Name <span className="text-destructive">*</span></Label>
                  <Input id="newProjectName" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g., Downtown Office Renovation" className="mt-1"/>
                  {addFormErrors.name && <p className="text-sm text-destructive mt-1">{addFormErrors.name}</p>}
                </div>
                 <div>
                  <Label htmlFor="newProjectClientInfo">Client Info</Label>
                  <Input id="newProjectClientInfo" value={newProjectClientInfo} onChange={(e) => setNewProjectClientInfo(e.target.value)} placeholder="e.g., Acme Corporation" className="mt-1"/>
                  {addFormErrors.clientInfo && <p className="text-sm text-destructive mt-1">{addFormErrors.clientInfo}</p>}
                </div>
                <div>
                  <Label htmlFor="newProjectDescription">Description</Label>
                  <Textarea id="newProjectDescription" value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="A brief description..." className="mt-1 min-h-[80px]"/>
                  {addFormErrors.description && <p className="text-sm text-destructive mt-1">{addFormErrors.description}</p>}
                </div>
                <div>
                  <Label htmlFor="newProjectImageUrl">Image URL</Label>
                  <Input id="newProjectImageUrl" type="url" value={newProjectImageUrl} onChange={(e) => setNewProjectImageUrl(e.target.value)} placeholder="https://placehold.co/600x400.png" className="mt-1"/>
                  {addFormErrors.imageUrl && <p className="text-sm text-destructive mt-1">{addFormErrors.imageUrl}</p>}
                </div>
                <div>
                  <Label htmlFor="newProjectDataAiHint">Data AI Hint (for image)</Label>
                  <Input id="newProjectDataAiHint" value={newProjectDataAiHint} onChange={(e) => setNewProjectDataAiHint(e.target.value)} placeholder="e.g., office building" className="mt-1"/>
                  {addFormErrors.dataAiHint && <p className="text-sm text-destructive mt-1">{addFormErrors.dataAiHint}</p>}
                </div>
                 <div>
                  <Label htmlFor="newProjectSupervisors">Assigned Supervisors</Label>
                  <SupervisorMultiSelect
                      selectedIds={newProjectSelectedSupervisorIds}
                      setSelectedIds={setNewProjectSelectedSupervisorIds}
                      availableSupervisors={availableSupervisors}
                      isLoading={isLoadingLookups}
                  />
                  {addFormErrors.assignedSupervisorIds && <p className="text-sm text-destructive mt-1">{addFormErrors.assignedSupervisorIds}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newProjectDueDate">Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={"outline"} className="w-full justify-start text-left font-normal mt-1">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newProjectDueDate ? format(newProjectDueDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarPrimitive mode="single" selected={newProjectDueDate} onSelect={setNewProjectDueDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                    {addFormErrors.dueDate && <p className="text-sm text-destructive mt-1">{addFormErrors.dueDate}</p>}
                  </div>
                  <div>
                    <Label htmlFor="newProjectBudget">Budget (USD)</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="newProjectBudget" type="number" value={newProjectBudget} onChange={(e) => setNewProjectBudget(e.target.value)} placeholder="e.g., 50000" className="pl-9"/>
                    </div>
                    {addFormErrors.budget && <p className="text-sm text-destructive mt-1">{addFormErrors.budget}</p>}
                  </div>
                </div>
              </form>
              <DialogFooter className="pt-4 border-t">
                <DialogClose asChild><Button type="button" variant="outline" onClick={() => { resetAddForm(); setShowAddProjectDialog(false);}} disabled={isSubmittingProject}>Cancel</Button></DialogClose>
                <Button type="submit" form="addProjectForm" onClick={handleAddProjectSubmit} disabled={isSubmittingProject} className="bg-accent hover:bg-accent/90">{isSubmittingProject ? "Creating Project..." : "Create Project & Add Tasks"}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline">Add Tasks for "{currentProjectNameForTaskCreation}"</DialogTitle>
                <DialogDescription>
                  Define initial tasks for this project.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3 overflow-y-auto px-1 flex-grow max-h-[calc(90vh-200px)]">
                {tasksToCreate.map((task, index) => (
                  <Card key={task.id} className="p-3 bg-muted/50">
                    <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                      <div className="space-y-2">
                          <div className="flex gap-2 items-end">
                              <div className="flex-grow">
                                  <Label htmlFor={`taskName-${index}`}>Task Name {index + 1} <span className="text-destructive">*</span></Label>
                                  <Input
                                      id={`taskName-${index}`}
                                      placeholder="Enter task name"
                                      value={task.name}
                                      onChange={(e) => handleNewTaskNameChange(index, e.target.value)}
                                      className="h-9 text-sm"
                                  />
                              </div>
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <Button type="button" variant="outline" size="sm">Library</Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 p-0">
                                      <Command>
                                          <CommandInput placeholder="Search library..." />
                                          <CommandList>
                                              <CommandEmpty>No tasks found.</CommandEmpty>
                                              <CommandGroup>
                                                  {predefinedTasks.map((pt) => (
                                                  <CommandItem
                                                      key={pt.id}
                                                      value={pt.name}
                                                      onSelect={() => handleSelectPredefinedTask(index, pt)}
                                                  >
                                                      {pt.name}
                                                  </CommandItem>
                                                  ))}
                                              </CommandGroup>
                                          </CommandList>
                                      </Command>
                                  </PopoverContent>
                              </Popover>
                          </div>
                        <Label htmlFor={`taskDesc-${index}`}>Description (Optional)</Label>
                        <Textarea
                          id={`taskDesc-${index}`}
                          placeholder="Brief task description"
                          value={task.description}
                          onChange={(e) => handleTaskDescriptionChange(index, e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex flex-col items-center space-y-2 pt-6">
                        {tasksToCreate.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTaskRow(index)} title="Remove Task">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {index === tasksToCreate.length - 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={handleAddTaskRow} title="Add New Task Row">
                            <PlusCircle className="h-5 w-5 text-primary" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <DialogFooter className="pt-4 border-t gap-2">
                 <Button type="button" variant="outline" onClick={finishProjectAndTaskCreation} disabled={isSubmittingTasks}>Skip & Finish Project</Button>
                 <Button type="button" onClick={handleSubmitTasksAndFinish} disabled={isSubmittingTasks || tasksToCreate.every(t => !t.name.trim())} className="bg-accent hover:bg-accent/90">
                   {isSubmittingTasks ? "Saving Tasks..." : "Save Tasks & Finish Project"}
                 </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Management"
        description="View, add, edit, and manage projects in the system."
        actions={pageActions}
      />
      <div className="flex items-center justify-between">
        <div></div>
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
            <Button size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'} onClick={() => setViewMode('list')}><Rows3 className="mr-2 h-4 w-4"/>List</Button>
            <Button size="sm" variant={viewMode === 'board' ? 'secondary' : 'ghost'} onClick={() => setViewMode('board')}><KanbanSquare className="mr-2 h-4 w-4"/>Board</Button>
        </div>
      </div>
      
      {viewMode === 'list' && (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Project List</CardTitle>
          <CardDescription>{isLoading ? "Loading projects..." : `Displaying ${startRange}-${endRange} of ${totalProjects} project(s).`}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 md:px-6">
          {isLoading && listProjects.length === 0 ? (
            <div className="flex justify-center items-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading projects...</p></div>
          ) : listProjects.length === 0 && !isLoading ? (
            <p className="text-muted-foreground text-center py-10">No projects found. Add one to get started.</p>
          ) : (
            <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listProjects.map((project) => (
                    <TableRow key={project.id} className="h-14 hover:bg-muted/50 transform hover:-translate-y-px transition-all">
                      <TableCell>
                        <Image 
                          src={project.imageUrl || 'https://placehold.co/100x60.png'} 
                          alt={project.name} 
                          width={100} 
                          height={60} 
                          className="rounded-md object-cover" 
                          data-ai-hint={project.dataAiHint || "project image"}
                        />
                      </TableCell>
                      <TableCell>
                          <Link href={`/dashboard/admin/projects/${project.id}`} className="font-medium text-primary hover:underline">{project.name}</Link>
                          <div className="text-xs text-muted-foreground">#{project.id.substring(0, 6)}</div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">{project.description || "N/A"}</p>
                                </TooltipTrigger>
                                {project.description && <TooltipContent><p>{project.description}</p></TooltipContent>}
                            </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>{getProjectStatusBadge(project.status)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.budget, false)}</TableCell>
                      <TableCell className={cn("text-right", project.dueDate && isPast(new Date(project.dueDate)) && "text-destructive font-semibold")}>
                          {project.dueDate && isPast(new Date(project.dueDate)) && <Clock className="inline-block mr-1 h-4 w-4"/>}
                          {project.dueDate && isValid(new Date(project.dueDate)) ? format(new Date(project.dueDate), "PP") : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon" title="View Project Details"><Link href={`/dashboard/admin/projects/${project.id}`}><Eye className="h-4 w-4" /><span className="sr-only">View</span></Link></Button>
                        <Button variant="ghost" size="icon" title="Edit Project" onClick={() => handleOpenEditDialog(project)}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                        <Button variant="ghost" size="icon" title="Delete Project" onClick={() => handleOpenDeleteDialog(project)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="md:hidden space-y-4">
              {listProjects.map(project => (
                  <Card key={project.id} className="overflow-hidden">
                      <CardHeader className="flex flex-row gap-4 items-start p-4">
                          <Image src={project.imageUrl || 'https://placehold.co/100x60.png'} alt={project.name} width={80} height={50} className="rounded-md object-cover" data-ai-hint={project.dataAiHint || "project image"}/>
                          <div className="flex-grow">
                              <Link href={`/dashboard/admin/projects/${project.id}`} className="font-bold text-primary hover:underline">{project.name}</Link>
                              <div className="flex items-center gap-2 mt-1">{getProjectStatusBadge(project.status)}</div>
                          </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2">
                           <p className="text-sm text-muted-foreground line-clamp-2">{project.description || "No description provided."}</p>
                           <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                               <div><strong>Budget:</strong> {formatCurrency(project.budget, false)}</div>
                               <div className={cn(project.dueDate && isPast(new Date(project.dueDate)) && "text-destructive font-semibold")}><strong>Due:</strong> {project.dueDate && isValid(new Date(project.dueDate)) ? format(new Date(project.dueDate), "PP") : 'N/A'}</div>
                           </div>
                      </CardContent>
                      <CardFooter className="bg-muted/50 p-2 flex justify-end">
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => router.push(`/dashboard/admin/projects/${project.id}`)}><Eye className="mr-2 h-4 w-4"/>View Details</DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleOpenEditDialog(project)}><Edit className="mr-2 h-4 w-4"/>Edit Project</DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleOpenDeleteDialog(project)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete Project</DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </CardFooter>
                  </Card>
              ))}
            </div>
            </>
          )}
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-end border-t pt-4">
                <div className="flex items-center gap-6">
                    <div className="text-sm font-medium text-muted-foreground">
                        {startRange}–{endRange} of {totalProjects}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" disabled={currentPage === 1 || isLoading} onClick={() => handlePageChange(currentPage - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                        <Button variant="outline" size="icon" disabled={currentPage === totalPages || isLoading} onClick={() => handlePageChange(currentPage + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardFooter>
        )}
      </Card>
      )}

      {viewMode === 'board' && (
        isLoading ? (
            <div className="flex justify-center items-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading board...</p></div>
        ) : (
            <ProjectKanbanBoard 
              projects={boardProjects} 
              onProjectUpdate={refreshData} 
            />
        )
      )}
        
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>
            <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle /> Developer Tools (Danger Zone)
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card className="border-destructive mt-2">
                <CardHeader>
                    <CardTitle className="text-destructive">Reset Data</CardTitle>
                    <CardDescription className="text-destructive/80">
                      These actions permanently delete data and are intended for development/testing only. They cannot be undone.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full" disabled={isResettingProjects}>
                          {isResettingProjects ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                          Delete All Transactional Data
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                              This action will permanently delete ALL transactional data, including projects, tasks, attendance, expenses, and payroll records. 
                              <br/><br/>
                              <strong className="text-destructive">User accounts will NOT be deleted.</strong>
                              <br/><br/>
                              To confirm, type <strong className="font-mono text-destructive">reset all data</strong> below.
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                           <Input placeholder="Type confirmation here" value={devActionConfirmInput} onChange={(e) => setDevActionConfirmInput(e.target.value)} />
                          <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDevActionConfirmInput('')}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleResetAllData} disabled={isResettingProjects || devActionConfirmInput !== 'reset all data'} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                              {isResettingProjects ? "Deleting..." : "Yes, delete data"}
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full" disabled={isDeletingAllUsers}>
                            <Users className="mr-2 h-4 w-4" />
                            Delete All Users
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you ABSOLUTELY sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete ALL users from both Firestore and Firebase Authentication,
                            except for your own admin account. This action cannot be undone and is extremely destructive.
                            <br/><br/>
                            To confirm, type <strong className="font-mono text-destructive">delete all users</strong> below.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input placeholder="Type confirmation here" value={devActionConfirmInput} onChange={(e) => setDevActionConfirmInput(e.target.value)} />
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDevActionConfirmInput('')}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAllUsers} disabled={isDeletingAllUsers || devActionConfirmInput !== 'delete all users'} className="bg-destructive hover:bg-destructive/90">
                              {isDeletingAllUsers ? "Deleting..." : "Yes, delete all users"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {editingProject && (
        <Dialog open={showEditProjectDialog} onOpenChange={(isOpen) => { if(!isOpen) setEditingProject(null); setShowEditProjectDialog(isOpen);}}>
            <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="font-headline">Edit Project: {editingProject.name}</DialogTitle>
                    <DialogDescription>Modify the project details below.</DialogDescription>
                </DialogHeader>
                <form id="editProjectForm" onSubmit={handleEditProjectSubmit} className="space-y-4 py-4 overflow-y-auto px-1 flex-grow">
                    <div>
                        <Label htmlFor="editProjectName">Project Name <span className="text-destructive">*</span></Label>
                        <Input id="editProjectName" value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} className="mt-1"/>
                        {editFormErrors.name && <p className="text-sm text-destructive mt-1">{editFormErrors.name}</p>}
                    </div>
                     <div>
                      <Label htmlFor="editProjectClientInfo">Client Info</Label>
                      <Input id="editProjectClientInfo" value={editProjectClientInfo} onChange={(e) => setEditProjectClientInfo(e.target.value)} className="mt-1"/>
                      {editFormErrors.clientInfo && <p className="text-sm text-destructive mt-1">{editFormErrors.clientInfo}</p>}
                    </div>
                    <div>
                        <Label htmlFor="editProjectDescription">Description</Label>
                        <Textarea id="editProjectDescription" value={editProjectDescription} onChange={(e) => setEditProjectDescription(e.target.value)} className="mt-1 min-h-[80px]"/>
                        {editFormErrors.description && <p className="text-sm text-destructive mt-1">{editFormErrors.description}</p>}
                    </div>
                    <div>
                        <Label htmlFor="editProjectImageUrl">Image URL</Label>
                        <Input id="editProjectImageUrl" type="url" value={editProjectImageUrl} onChange={(e) => setEditProjectImageUrl(e.target.value)} className="mt-1"/>
                        {editFormErrors.imageUrl && <p className="text-sm text-destructive mt-1">{editFormErrors.imageUrl}</p>}
                    </div>
                    <div>
                        <Label htmlFor="editProjectDataAiHint">Data AI Hint</Label>
                        <Input id="editProjectDataAiHint" value={editProjectDataAiHint} onChange={(e) => setEditProjectDataAiHint(e.target.value)} className="mt-1"/>
                        {editFormErrors.dataAiHint && <p className="text-sm text-destructive mt-1">{editFormErrors.dataAiHint}</p>}
                    </div>
                    <div>
                        <Label htmlFor="editProjectStatus">Project Status <span className="text-destructive">*</span></Label>
                        <Select value={editProjectStatus} onValueChange={(value) => setEditProjectStatus(value as ProjectStatus)}>
                            <SelectTrigger id="editProjectStatus" className="mt-1">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                {projectStatusOptions.map(s => (
                                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {editFormErrors.status && <p className="text-sm text-destructive mt-1">{editFormErrors.status}</p>}
                    </div>
                    <div>
                        <Label htmlFor="editProjectSupervisors">Assigned Supervisors</Label>
                         <SupervisorMultiSelect
                            selectedIds={editProjectSelectedSupervisorIds}
                            setSelectedIds={setEditProjectSelectedSupervisorIds}
                            availableSupervisors={availableSupervisors}
                            isLoading={isLoadingLookups}
                        />
                        {editFormErrors.assignedSupervisorIds && <p className="text-sm text-destructive mt-1">{editFormErrors.assignedSupervisorIds}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="editProjectDueDate">Due Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant={"outline"} className="w-full justify-start text-left font-normal mt-1">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {editProjectDueDate ? format(new Date(editProjectDueDate), "PPP") : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <CalendarPrimitive mode="single" selected={editProjectDueDate ? new Date(editProjectDueDate) : undefined} onSelect={(date) => setEditProjectDueDate(date || null)} initialFocus />
                                </PopoverContent>
                            </Popover>
                            {editFormErrors.dueDate && <p className="text-sm text-destructive mt-1">{editFormErrors.dueDate}</p>}
                        </div>
                        <div>
                            <Label htmlFor="editProjectBudget">Budget (USD)</Label>
                            <div className="relative mt-1">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="editProjectBudget" type="number" value={editProjectBudget} onChange={(e) => setEditProjectBudget(e.target.value)} className="pl-9"/>
                            </div>
                            {editFormErrors.budget && <p className="text-sm text-destructive mt-1">{editFormErrors.budget}</p>}
                        </div>
                    </div>
                    </form>
                    <DialogFooter className="pt-4 border-t">
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingEdit}>Cancel</Button></DialogClose>
                        <Button type="submit" form="editProjectForm" disabled={isSubmittingEdit} className="bg-accent hover:bg-accent/90">{isSubmittingEdit ? "Saving..." : "Save Changes"}</Button>
                    </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {projectToDelete && (
        <AlertDialog open={showDeleteProjectDialog} onOpenChange={(isOpen) => { if(!isOpen) setProjectToDelete(null); setShowDeleteProjectDialog(isOpen); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project: {projectToDelete.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the project record. This action cannot be undone. Associated tasks and expenses will remain but will be orphaned.
                        <br/><br/>
                        To confirm, please type the project name: <strong className="font-mono text-destructive">{projectToDelete.name}</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <Input 
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="Type project name here"
                />
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowDeleteProjectDialog(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteProjectConfirm} 
                      disabled={isDeleting || deleteConfirmInput !== projectToDelete.name} 
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isDeleting ? "Deleting..." : "Delete Project"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
