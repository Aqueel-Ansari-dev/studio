
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlusCircle, RefreshCw, LibraryBig, Edit, Trash2, Eye, CalendarIcon, DollarSign, FileText, ChevronDown } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { format, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchProjectsForAdmin, type ProjectForAdminList, type FetchProjectsForAdminResult } from '@/app/actions/admin/fetchProjectsForAdmin';
import { createProject, type CreateProjectInput, type CreateProjectResult } from '@/app/actions/admin/createProject';
import { deleteProjectByAdmin, type DeleteProjectResult } from '@/app/actions/admin/deleteProject';
import { updateProjectByAdmin, type UpdateProjectInput, type UpdateProjectResult } from '@/app/actions/admin/updateProject';
import { createQuickTaskForAssignment, type CreateQuickTaskInput, type CreateQuickTaskResult } from '@/app/actions/supervisor/createTask';

const PROJECTS_PER_PAGE = 10;

interface TaskToCreate {
  id: string; // for unique key in map
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
  
  const [allLoadedProjects, setAllLoadedProjects] = useState<ProjectForAdminList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastVisibleName, setLastVisibleName] = useState<string | null | undefined>(undefined);
  const [hasMoreProjects, setHasMoreProjects] = useState(true);
  

  // Add Project Dialog
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectImageUrl, setNewProjectImageUrl] = useState('');
  const [newProjectDataAiHint, setNewProjectDataAiHint] = useState('');
  const [newProjectDueDate, setNewProjectDueDate] = useState<Date | undefined>(undefined);
  const [newProjectBudget, setNewProjectBudget] = useState<string>('');
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  // Task Creation Step for Add Project
  const [showTaskCreationStep, setShowTaskCreationStep] = useState(false);
  const [currentProjectIdForTaskCreation, setCurrentProjectIdForTaskCreation] = useState<string | null>(null);
  const [currentProjectNameForTaskCreation, setCurrentProjectNameForTaskCreation] = useState<string>('');
  const [tasksToCreate, setTasksToCreate] = useState<TaskToCreate[]>([{ id: crypto.randomUUID(), name: '', description: '' }]);
  const [isSubmittingTasks, setIsSubmittingTasks] = useState(false);


  // Edit Project Dialog
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectForAdminList | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [editProjectImageUrl, setEditProjectImageUrl] = useState('');
  const [editProjectDataAiHint, setEditProjectDataAiHint] = useState('');
  const [editProjectDueDate, setEditProjectDueDate] = useState<Date | undefined | null>(undefined);
  const [editProjectBudget, setEditProjectBudget] = useState<string>('');
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  

  // Delete Project Dialog
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectForAdminList | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const loadProjects = useCallback(async (loadMore = false) => {
    if (!user?.id) {
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }
    if (!loadMore) {
        setIsLoading(true);
        setAllLoadedProjects([]);
        setLastVisibleName(undefined);
        setHasMoreProjects(true);
    } else {
        if (!hasMoreProjects || lastVisibleName === null) return;
        setIsLoadingMore(true);
    }
    
    try {
      const result: FetchProjectsForAdminResult = await fetchProjectsForAdmin(
        PROJECTS_PER_PAGE,
        loadMore ? lastVisibleName : undefined
      );
      if (result.success && result.projects) {
        setAllLoadedProjects(prev => loadMore ? [...prev, ...result.projects!] : result.projects!);
        setLastVisibleName(result.lastVisibleName);
        setHasMoreProjects(result.hasMore || false);
      } else {
        if (!loadMore) setAllLoadedProjects([]);
        setHasMoreProjects(false);
        toast({
          title: "Error Loading Projects",
          description: result.error || "Could not load projects. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      if (!loadMore) setAllLoadedProjects([]);
      setHasMoreProjects(false);
      toast({
        title: "Error Loading Projects",
        description: "An unexpected error occurred while fetching projects.",
        variant: "destructive",
      });
    } finally {
      if (!loadMore) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, [toast, lastVisibleName, hasMoreProjects, user?.id]);

  useEffect(() => {
    if (user?.id) {
     loadProjects();
    }
  }, [loadProjects, user?.id]);

  const resetAddForm = () => {
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectImageUrl('');
    setNewProjectDataAiHint('');
    setNewProjectDueDate(undefined);
    setNewProjectBudget('');
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
      dueDate: newProjectDueDate || null,
      budget: newProjectBudget ? parseFloat(newProjectBudget) : null,
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

  const handleTaskInputChange = (index: number, field: 'name' | 'description', value: string) => {
    const newTasks = [...tasksToCreate];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasksToCreate(newTasks);
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
  
  const handleTaskNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter' && index === tasksToCreate.length - 1) {
      e.preventDefault();
      handleAddTaskRow();
      setTimeout(() => {
        const nextInput = document.getElementById(`taskName-${tasksToCreate.length}`); 
        nextInput?.focus();
      }, 0);
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
    loadProjects();
    setIsSubmittingTasks(false);
  }


  const handleOpenEditDialog = (project: ProjectForAdminList) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectDescription(project.description || '');
    setEditProjectImageUrl(project.imageUrl || '');
    setEditProjectDataAiHint(project.dataAiHint || '');
    setEditProjectDueDate(project.dueDate ? new Date(project.dueDate) : null);
    setEditProjectBudget(project.budget ? String(project.budget) : '');
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
        dueDate: editProjectDueDate,
        budget: editProjectBudget && editProjectBudget.trim() !== '' ? parseFloat(editProjectBudget) : null,
    };
    
    const result: UpdateProjectResult = await updateProjectByAdmin(user.id, editingProject.id, updateInput);

    if (result.success) {
        toast({ title: "Project Updated", description: result.message });
        setShowEditProjectDialog(false);
        setEditingProject(null);
        loadProjects();
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
  };

  const handleDeleteProjectConfirm = async () => {
    if (!user || !projectToDelete) return;
    setIsDeleting(true);
    const result: DeleteProjectResult = await deleteProjectByAdmin(user.id, projectToDelete.id);
    if (result.success) {
      toast({ title: "Project Deleted", description: result.message });
      loadProjects();
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setShowDeleteProjectDialog(false);
    setProjectToDelete(null);
    setIsDeleting(false);
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Management"
        description="View, add, edit, and manage projects in the system."
        actions={
          <>
            <Button variant="outline" onClick={() => loadProjects(false)} disabled={isLoading || isLoadingMore} className="mr-2">
              <RefreshCw className={`h-4 w-4 ${(isLoading || isLoadingMore) ? 'animate-spin' : ''} mr-2`} />
              Refresh Projects
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
                    <form onSubmit={handleAddProjectSubmit} className="space-y-4 py-4 overflow-y-auto px-1 flex-grow">
                      <div>
                        <Label htmlFor="newProjectName">Project Name <span className="text-destructive">*</span></Label>
                        <Input id="newProjectName" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g., Downtown Office Renovation" className="mt-1"/>
                        {addFormErrors.name && <p className="text-sm text-destructive mt-1">{addFormErrors.name}</p>}
                      </div>
                      <div>
                        <Label htmlFor="newProjectDescription">Description</Label>
                        <Textarea id="newProjectDescription" value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="A brief description..." className="mt-1 min-h-[80px]"/>
                        {addFormErrors.description && <p className="text-sm text-destructive mt-1">{addFormErrors.description}</p>}
                      </div>
                      <div>
                        <Label htmlFor="newProjectImageUrl">Image URL</Label>
                        <Input id="newProjectImageUrl" type="url" value={newProjectImageUrl} onChange={(e) => setNewProjectImageUrl(e.target.value)} placeholder="https://example.com/image.png" className="mt-1"/>
                        {addFormErrors.imageUrl && <p className="text-sm text-destructive mt-1">{addFormErrors.imageUrl}</p>}
                      </div>
                      <div>
                        <Label htmlFor="newProjectDataAiHint">Data AI Hint (for image)</Label>
                        <Input id="newProjectDataAiHint" value={newProjectDataAiHint} onChange={(e) => setNewProjectDataAiHint(e.target.value)} placeholder="e.g., office building" className="mt-1"/>
                        {addFormErrors.dataAiHint && <p className="text-sm text-destructive mt-1">{addFormErrors.dataAiHint}</p>}
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
                              <Calendar mode="single" selected={newProjectDueDate} onSelect={setNewProjectDueDate} initialFocus />
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
                        Define initial tasks for this project. Press Enter in the last task name field or click '+' to add more tasks.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3 overflow-y-auto px-1 flex-grow max-h-[calc(90vh-200px)]">
                      {tasksToCreate.map((task, index) => (
                        <Card key={task.id} className="p-3 bg-muted/50">
                          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                            <div className="space-y-2">
                              <Label htmlFor={`taskName-${index}`}>Task Name {index + 1} <span className="text-destructive">*</span></Label>
                              <Input
                                id={`taskName-${index}`}
                                placeholder="e.g., Initial Site Survey"
                                value={task.name}
                                onChange={(e) => handleTaskInputChange(index, 'name', e.target.value)}
                                onKeyDown={(e) => handleTaskNameKeyDown(e, index)}
                              />
                              <Label htmlFor={`taskDesc-${index}`}>Description (Optional)</Label>
                              <Textarea
                                id={`taskDesc-${index}`}
                                placeholder="Brief task description"
                                value={task.description}
                                onChange={(e) => handleTaskInputChange(index, 'description', e.target.value)}
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
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Project List</CardTitle>
          <CardDescription>{isLoading && allLoadedProjects.length === 0 ? "Loading projects..." : `Displaying ${allLoadedProjects.length} project(s).`}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && allLoadedProjects.length === 0 ? (
            <div className="flex justify-center items-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading projects...</p></div>
          ) : allLoadedProjects.length === 0 && !isLoading ? (
            <p className="text-muted-foreground text-center py-10">No projects found. Add one to get started.</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Budget</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLoadedProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Image src={project.imageUrl || `https://placehold.co/100x60.png?text=${project.name.substring(0,3)}`} alt={project.name} width={100} height={60} className="rounded-md object-cover" data-ai-hint={project.dataAiHint || "project image"}/>
                    </TableCell>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs hidden md:table-cell">{project.description || "N/A"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">{formatCurrency(project.budget, false)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">{project.dueDate && isValid(new Date(project.dueDate)) ? format(new Date(project.dueDate), "PP") : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="ghost" size="icon" title="View Project Details"><Link href={`/dashboard/admin/projects/${project.id}`}><Eye className="h-4 w-4" /><span className="sr-only">View</span></Link></Button>
                       <Button variant="ghost" size="icon" title="Edit Project" onClick={() => handleOpenEditDialog(project)}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                       <Button variant="ghost" size="icon" title="Delete Project" onClick={() => handleOpenDeleteDialog(project)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMoreProjects && (
              <div className="mt-6 text-center">
                <Button onClick={() => loadProjects(true)} disabled={isLoadingMore}>
                  {isLoadingMore ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ChevronDown className="mr-2 h-4 w-4"/>}
                  Load More Projects
                </Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Project Dialog */}
      {editingProject && (
        <Dialog open={showEditProjectDialog} onOpenChange={(isOpen) => { if(!isOpen) setEditingProject(null); setShowEditProjectDialog(isOpen);}}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-headline">Edit Project: {editingProject.name}</DialogTitle>
                    <DialogDescription>Modify the project details below.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEditProjectSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="editProjectName">Project Name <span className="text-destructive">*</span></Label>
                        <Input id="editProjectName" value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} className="mt-1"/>
                        {editFormErrors.name && <p className="text-sm text-destructive mt-1">{editFormErrors.name}</p>}
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
                                <Calendar mode="single" selected={editProjectDueDate ? new Date(editProjectDueDate) : undefined} onSelect={(date) => setEditProjectDueDate(date || null)} initialFocus />
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
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingEdit}>Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isSubmittingEdit} className="bg-accent hover:bg-accent/90">{isSubmittingEdit ? "Saving..." : "Save Changes"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      )}

      {/* Delete Project Confirmation Dialog */}
      {projectToDelete && (
        <AlertDialog open={showDeleteProjectDialog} onOpenChange={(isOpen) => { if(!isOpen) setProjectToDelete(null); setShowDeleteProjectDialog(isOpen); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project: {projectToDelete.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this project? This action cannot be undone. 
                        <br /><strong>Important:</strong> This will only delete the project record itself. 
                        Associated tasks, inventory, and expenses will NOT be automatically deleted.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowDeleteProjectDialog(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProjectConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isDeleting ? "Deleting..." : "Delete Project"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
