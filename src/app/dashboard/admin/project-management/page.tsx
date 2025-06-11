
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
import { PlusCircle, RefreshCw, LibraryBig, Edit, Trash2, Eye, CalendarIcon, DollarSign } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchProjectsForAdmin, type ProjectForAdminList, type FetchProjectsForAdminResult } from '@/app/actions/admin/fetchProjectsForAdmin';
import { createProject, type CreateProjectInput, type CreateProjectResult } from '@/app/actions/admin/createProject';
import { deleteProjectByAdmin, type DeleteProjectResult } from '@/app/actions/admin/deleteProject';
import { updateProjectByAdmin, type UpdateProjectInput, type UpdateProjectResult } from '@/app/actions/admin/updateProject';

export default function ProjectManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectForAdminList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Project Dialog
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectImageUrl, setNewProjectImageUrl] = useState('');
  const [newProjectDataAiHint, setNewProjectDataAiHint] = useState('');
  const [newProjectDueDate, setNewProjectDueDate] = useState<Date | undefined>(undefined);
  const [newProjectBudget, setNewProjectBudget] = useState<string>('');
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string | undefined>>({});

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


  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const result: FetchProjectsForAdminResult = await fetchProjectsForAdmin();
      if (result.success && result.projects) {
        setProjects(result.projects);
      } else {
        setProjects([]); // Ensure projects is an array even on failure
        toast({
          title: "Error Loading Projects",
          description: result.error || "Could not load projects. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setProjects([]); // Ensure projects is an array on catch
      toast({
        title: "Error Loading Projects",
        description: "An unexpected error occurred while fetching projects.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const resetAddForm = () => {
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectImageUrl('');
    setNewProjectDataAiHint('');
    setNewProjectDueDate(undefined);
    setNewProjectBudget('');
    setAddFormErrors({});
  }

  const handleAddProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
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

    if (result.success) {
      toast({
        title: "Project Created!",
        description: `Project "${newProjectName}" has been successfully created.`,
      });
      resetAddForm();
      setShowAddProjectDialog(false);
      loadProjects(); 
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
    setIsSubmitting(false);
  };

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
        budget: editProjectBudget ? parseFloat(editProjectBudget) : null,
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
            <Button variant="outline" onClick={loadProjects} disabled={isLoading} className="mr-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} mr-2`} />
              Refresh Projects
            </Button>
            <Dialog open={showAddProjectDialog} onOpenChange={setShowAddProjectDialog}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-headline">Add New Project</DialogTitle>
                  <DialogDescription>
                    Fill in the details for the new project. Fields with <span className="text-destructive">*</span> are required.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddProjectSubmit} className="space-y-4 py-4">
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
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" onClick={() => { resetAddForm(); setShowAddProjectDialog(false);}} disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90">{isSubmitting ? "Adding..." : "Add Project"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Project List</CardTitle>
          <CardDescription>{isLoading ? "Loading projects..." : `Displaying ${projects.length} project(s).`}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading projects...</p></div>
          ) : projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No projects found. Add one to get started.</p>
          ) : (
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
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Image src={project.imageUrl || `https://placehold.co/100x60.png?text=${project.name.substring(0,3)}`} alt={project.name} width={100} height={60} className="rounded-md object-cover" data-ai-hint={project.dataAiHint || "project image"}/>
                    </TableCell>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs hidden md:table-cell">{project.description || "N/A"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">{project.budget ? `$${Number(project.budget).toLocaleString()}` : 'N/A'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">{project.dueDate ? format(new Date(project.dueDate), "PP") : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="ghost" size="icon" title="View Project Details"><Link href={`/dashboard/admin/projects/${project.id}`}><Eye className="h-4 w-4" /><span className="sr-only">View</span></Link></Button>
                       <Button variant="ghost" size="icon" title="Edit Project" onClick={() => handleOpenEditDialog(project)}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                       <Button variant="ghost" size="icon" title="Delete Project" onClick={() => handleOpenDeleteDialog(project)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
