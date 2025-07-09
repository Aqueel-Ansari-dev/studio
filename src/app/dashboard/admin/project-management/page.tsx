
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, RefreshCw, Edit, Trash2, Search, LibraryBig, ChevronLeft, ChevronRight, Eye, Briefcase, ChevronsUpDown, UserPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon } from 'lucide-react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';

import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

import { fetchProjectsForAdmin, type ProjectForAdminList, type FetchProjectsForAdminFilters } from '@/app/actions/admin/fetchProjectsForAdmin';
import { countProjects } from '@/app/actions/admin/countProjects';
import { createProjectByAdmin } from '@/app/actions/admin/createProject';
import { updateProjectByAdmin, type UpdateProjectInput } from '@/app/actions/admin/updateProject';
import { deleteProjectByAdmin } from '@/app/actions/admin/deleteProject';
import { fetchUsersByRole } from '@/app/actions/common/fetchUsersByRole';
import type { ProjectStatus, UserForSelection } from '@/types/database';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';


const NewSupervisorSchema = z.object({
  displayName: z.string().min(2, { message: "Supervisor name must be at least 2 characters."}),
  email: z.string().email({ message: "A valid email is required for new supervisors." }),
});

const projectFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters.').max(100),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  dataAiHint: z.string().optional(),
  clientInfo: z.string().optional(),
  dueDate: z.date().optional(),
  budget: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(val)),
    z.number().nonnegative().optional()
  ),
  assignedSupervisorIds: z.array(z.string()).optional(),
  newSupervisorsToCreate: z.array(NewSupervisorSchema).optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function ProjectManagementPage() {
  const { user: adminUser, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectForAdminList[]>([]);
  const [supervisors, setSupervisors] = useState<UserForSelection[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalProjects, setTotalProjects] = useState(0);
  const totalPages = Math.ceil(totalProjects / pageSize);
  const startRange = totalProjects > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRange = Math.min(currentPage * pageSize, totalProjects);

  const [filters, setFilters] = useState<FetchProjectsForAdminFilters>({ searchTerm: '' });
  const { toast } = useToast();

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectForAdminList | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProject, setDeletingProject] = useState<ProjectForAdminList | null>(null);

  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
  });

  const createForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      imageUrl: '',
      dataAiHint: '',
      clientInfo: '',
      dueDate: undefined,
      budget: undefined,
      assignedSupervisorIds: [],
      newSupervisorsToCreate: [],
    },
  });

  const { fields: newSupervisorFields, append: appendSupervisor, remove: removeSupervisor } = useFieldArray({
    control: createForm.control,
    name: "newSupervisorsToCreate"
  });

  const loadData = useCallback(async (page: number) => {
    if (!adminUser?.id) return;
    setIsFetching(true);
    try {
      const [countRes, projectsRes, supervisorsRes] = await Promise.all([
        countProjects(adminUser.id),
        fetchProjectsForAdmin(adminUser.id, page, pageSize, filters),
        fetchUsersByRole(adminUser.id, 'supervisor')
      ]);

      if (countRes.success) setTotalProjects(countRes.count ?? 0);
      else toast({ title: "Error", description: countRes.error, variant: "destructive" });

      if (projectsRes.success && projectsRes.projects) setProjects(projectsRes.projects);
      else toast({ title: "Error", description: projectsRes.error, variant: "destructive" });
      
      if (supervisorsRes.success && supervisorsRes.users) setSupervisors(supervisorsRes.users);
      else toast({ title: "Error", description: "Could not fetch supervisors.", variant: "destructive" });

    } catch (err) {
      toast({ title: "Error", description: "Could not fetch project data.", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  }, [adminUser?.id, filters, pageSize, toast]);

  useEffect(() => {
    if (!authLoading && adminUser?.role === 'admin') {
      loadData(currentPage);
    }
  }, [adminUser, authLoading, loadData, currentPage]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);
  
  const handleCreateClick = () => {
    createForm.reset();
    setShowCreateSheet(true);
  };

  const handleEditClick = (project: ProjectForAdminList) => {
    setEditingProject(project);
    editForm.reset({
      name: project.name,
      description: project.description,
      imageUrl: project.imageUrl,
      dataAiHint: project.dataAiHint,
      clientInfo: project.clientInfo,
      dueDate: project.dueDate ? parseISO(project.dueDate) : undefined,
      budget: project.budget ?? undefined,
      assignedSupervisorIds: project.assignedSupervisorIds || [],
    });
    setShowEditSheet(true);
  };
  
  const handleDeleteClick = (project: ProjectForAdminList) => {
    setDeletingProject(project);
    setShowDeleteConfirm(true);
  };

  const onCreateSubmit = async (data: ProjectFormValues) => {
    if (!adminUser) return;
    const result = await createProjectByAdmin(adminUser.id, data);
    if (result.success) {
      toast({ title: "Project Created", description: result.message, duration: 5000 });
      setShowCreateSheet(false);
      loadData(1);
    } else {
      toast({ title: "Creation Failed", description: result.message, variant: "destructive" });
    }
  };

  const onEditSubmit = async (data: ProjectFormValues) => {
    if (!editingProject || !adminUser) return;
    const result = await updateProjectByAdmin(adminUser.id, editingProject.id, data);
    if(result.success) {
        toast({ title: "Project Updated", description: `"${data.name}" has been updated.`});
        setShowEditSheet(false);
        loadData(currentPage);
    } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive"});
    }
  };

  const onDeleteConfirm = async () => {
    if (!deletingProject || !adminUser) return;
    const result = await deleteProjectByAdmin(adminUser.id, deletingProject.id);
    if(result.success) {
        toast({ title: "Project Deleted", description: result.message });
        setShowDeleteConfirm(false);
        setDeletingProject(null);
        loadData(1);
    } else {
        toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
  };
  
  const handlePageChange = (newPage: number) => {
    if(newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
    }
  };

  const statusColors: Record<ProjectStatus, string> = {
    active: "bg-green-500",
    paused: "bg-orange-500",
    completed: "bg-blue-500",
    inactive: "bg-gray-500",
  };
  
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Project Management" 
        description="Oversee all projects in the system." 
        actions={
          <Button onClick={handleCreateClick}>
            <PlusCircle className="mr-2 h-4 w-4"/> Create Project
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <Input 
            placeholder="Search by project name..."
            onChange={(e) => {
                const term = e.target.value;
                setFilters(prev => ({ ...prev, searchTerm: term }));
            }}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden lg:table-cell">Client</TableHead>
                        <TableHead className="hidden md:table-cell">Due Date</TableHead>
                        <TableHead className="hidden md:table-cell">Budget</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isFetching ? [...Array(pageSize)].map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                        <TableCell><Skeleton className="h-4 w-4 rounded-full"/></TableCell>
                        <TableCell><Skeleton className="h-5 w-40"/></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-24"/></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-20"/></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24"/></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto"/></TableCell>
                    </TableRow>
                )) : projects.map(p => (
                    <TableRow key={p.id}>
                        <TableCell><div className={cn("h-2.5 w-2.5 rounded-full", statusColors[p.status])} title={p.status}/></TableCell>
                        <TableCell><Link href={`/dashboard/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link></TableCell>
                        <TableCell className="hidden lg:table-cell">{p.clientInfo || 'N/A'}</TableCell>
                        <TableCell className="hidden md:table-cell">{p.dueDate ? format(parseISO(p.dueDate), 'PP') : 'N/A'}</TableCell>
                        <TableCell className="hidden md:table-cell">{p.budget ? `$${p.budget.toLocaleString()}` : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => handleEditClick(p)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => router.push(`/dashboard/admin/projects/${p.id}`)}><Eye className="mr-2 h-4 w-4"/>View Details</DropdownMenuItem>
                                    <DropdownMenuSeparator/>
                                    <DropdownMenuItem onSelect={() => handleDeleteClick(p)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
             {projects.length === 0 && !isFetching && <p className="text-center py-6 text-muted-foreground">No projects found for the current filters.</p>}
        </CardContent>
         {totalPages > 1 && (
            <CardFooter className="flex items-center justify-end border-t pt-4">
                <div className="flex items-center gap-6">
                    <div className="text-sm font-medium text-muted-foreground">{startRange}–{endRange} of {totalProjects}</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" disabled={currentPage === 1 || isFetching} onClick={() => handlePageChange(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                        <Button variant="outline" size="icon" disabled={currentPage === totalPages || isFetching} onClick={() => handlePageChange(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
            </CardFooter>
        )}
      </Card>

      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent className="sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Create New Project</SheetTitle>
              <SheetDescription>Fill in the details for the new project.</SheetDescription>
            </SheetHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
              <div className="space-y-1">
                  <Label>Project Name</Label>
                  <Input {...createForm.register('name')} placeholder="e.g., Downtown Office Renovation" />
                  {createForm.formState.errors.name && <p className="text-destructive text-sm">{createForm.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea {...createForm.register('description')} placeholder="Briefly describe the project scope." />
              </div>
              <div className="space-y-1">
                  <Label>Client Info</Label>
                  <Input {...createForm.register('clientInfo')} placeholder="e.g., Acme Corporation" />
              </div>
              <div className="space-y-1">
                  <Label>Image URL</Label>
                  <Input {...createForm.register('imageUrl')} placeholder="https://placehold.co/600x400.png" />
              </div>
              <div className="space-y-1">
                  <Label>Budget ($)</Label>
                  <Input {...createForm.register('budget')} type="number" placeholder="e.g., 50000" />
              </div>
              <div className="space-y-1">
                  <Label>Due Date</Label>
                  <Controller name="dueDate" control={createForm.control} render={({ field }) => (
                          <Popover>
                              <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : "Select a due date"}</Button></PopoverTrigger>
                              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent>
                          </Popover>
                  )}/>
              </div>
               <div>
                  <Label>Assign Existing Supervisors</Label>
                   <Controller
                      control={createForm.control}
                      name="assignedSupervisorIds"
                      render={({ field }) => (
                        <SupervisorMultiSelect
                          selectedIds={field.value || []}
                          setSelectedIds={field.onChange}
                          availableSupervisors={supervisors}
                        />
                      )}
                    />
                </div>
                 <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                    <Label className="font-semibold">Create & Assign New Supervisors</Label>
                    <div className="space-y-2">
                      {newSupervisorFields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-2 p-2 border bg-background rounded-md">
                          <div className="flex-grow grid grid-cols-2 gap-2">
                             <div>
                                <Label htmlFor={`newSupervisorsToCreate.${index}.displayName`} className="text-xs">Full Name</Label>
                                <Input {...createForm.register(`newSupervisorsToCreate.${index}.displayName`)} placeholder="Supervisor Name"/>
                             </div>
                             <div>
                                <Label htmlFor={`newSupervisorsToCreate.${index}.email`} className="text-xs">Email</Label>
                                <Input type="email" {...createForm.register(`newSupervisorsToCreate.${index}.email`)} placeholder="supervisor@email.com"/>
                             </div>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSupervisor(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        </div>
                      ))}
                    </div>
                     <Button type="button" variant="outline" size="sm" className="mt-2 border-dashed" onClick={() => appendSupervisor({ displayName: '', email: '' })}>
                        <UserPlus className="mr-2 h-4 w-4" /> Add New Supervisor
                    </Button>
                </div>
              <div className="flex justify-end gap-2 pt-4">
                  <SheetClose asChild><Button type="button" variant="outline">Cancel</Button></SheetClose>
                  <Button type="submit" disabled={createForm.formState.isSubmitting}>
                      {createForm.formState.isSubmitting ? "Creating..." : "Create Project"}
                  </Button>
              </div>
            </form>
        </SheetContent>
      </Sheet>
      
      {editingProject && <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent className="sm:max-w-lg">
            <SheetHeader><SheetTitle>Edit Project: {editingProject.name}</SheetTitle><SheetDescription>Make changes to the project details here.</SheetDescription></SheetHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                <Input {...editForm.register('name')} placeholder="Project Name"/>
                <Textarea {...editForm.register('description')} placeholder="Description"/>
                <Input {...editForm.register('clientInfo')} placeholder="Client Info"/>
                <Input {...editForm.register('imageUrl')} placeholder="Image URL"/>
                <Input {...editForm.register('budget')} type="number" placeholder="Budget"/>
                 <Controller name="dueDate" control={editForm.control} render={({ field }) => (
                     <Popover>
                        <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : "Due Date"}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent>
                     </Popover>
                )}/>
                <div>
                  <Label>Supervisors</Label>
                   <Controller
                      control={editForm.control}
                      name="assignedSupervisorIds"
                      render={({ field }) => (
                        <SupervisorMultiSelect
                          selectedIds={field.value || []}
                          setSelectedIds={field.onChange}
                          availableSupervisors={supervisors}
                        />
                      )}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <SheetClose asChild><Button type="button" variant="outline">Cancel</Button></SheetClose>
                    <Button type="submit" disabled={editForm.formState.isSubmitting}>Save Changes</Button>
                </div>
            </form>
        </SheetContent>
      </Sheet>}

       {deletingProject && <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete {deletingProject.name}?</AlertDialogTitle><AlertDialogDescription>This action is permanent and cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>}

    </div>
  );
}

function SupervisorMultiSelect({
  selectedIds,
  setSelectedIds,
  availableSupervisors
}: {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  availableSupervisors: UserForSelection[];
}) {
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
    .join(', ');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">{selectedSupervisorsText || "Select supervisors..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <ScrollArea className="max-h-60">
          <div className="p-2 space-y-1">
            {availableSupervisors.length === 0 && <p className="text-center text-sm text-muted-foreground p-2">No supervisors found.</p>}
            {availableSupervisors.map((supervisor) => (
              <div
                key={supervisor.id}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                onClick={() => handleSelect(supervisor.id)}
              >
                <Checkbox
                  id={`supervisor-${supervisor.id}`}
                  checked={selectedIds.includes(supervisor.id)}
                  onCheckedChange={() => handleSelect(supervisor.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label htmlFor={`supervisor-${supervisor.id}`} className="font-normal cursor-pointer flex-grow">
                  {supervisor.name}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
