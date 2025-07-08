
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, RefreshCw, Edit, Trash2, Search, LibraryBig, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';

import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

import { fetchProjectsForAdmin, type ProjectForAdminList, type FetchProjectsForAdminFilters, type FetchProjectsForAdminResult } from '@/app/actions/admin/fetchProjectsForAdmin';
import { countProjects } from '@/app/actions/admin/countProjects';
import { updateProjectByAdmin, type UpdateProjectInput } from '@/app/actions/admin/updateProject';
import { deleteProjectByAdmin } from '@/app/actions/admin/deleteProject';
import type { ProjectStatus } from '@/types/database';

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
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function ProjectManagementPage() {
  const { user: adminUser, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectForAdminList[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalProjects, setTotalProjects] = useState(0);
  const totalPages = Math.ceil(totalProjects / pageSize);
  const startRange = totalProjects > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRange = Math.min(currentPage * pageSize, totalProjects);

  const [filters, setFilters] = useState<FetchProjectsForAdminFilters>({ searchTerm: '' });
  const { toast } = useToast();

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectForAdminList | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProject, setDeletingProject] = useState<ProjectForAdminList | null>(null);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
  });

  const loadData = useCallback(async (page: number) => {
    if (!adminUser?.id) return;
    setIsFetching(true);
    try {
      const [countRes, projectsRes] = await Promise.all([
        countProjects(),
        fetchProjectsForAdmin(page, pageSize, adminUser.id, filters)
      ]);

      if (countRes.success) {
        setTotalProjects(countRes.count ?? 0);
      } else {
        setTotalProjects(0);
        toast({ title: "Error", description: countRes.error, variant: "destructive" });
      }

      if (projectsRes.success && projectsRes.projects) {
        setProjects(projectsRes.projects);
      } else {
        setProjects([]);
        toast({ title: "Error", description: projectsRes.error, variant: "destructive" });
      }
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

  const handleEditClick = (project: ProjectForAdminList) => {
    setEditingProject(project);
    form.reset({
      name: project.name,
      description: project.description,
      imageUrl: project.imageUrl,
      dataAiHint: project.dataAiHint,
      clientInfo: project.clientInfo,
      dueDate: project.dueDate ? parseISO(project.dueDate) : undefined,
      budget: project.budget ?? undefined,
    });
    setShowEditSheet(true);
  };
  
  const handleDeleteClick = (project: ProjectForAdminList) => {
    setDeletingProject(project);
    setShowDeleteConfirm(true);
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
      <PageHeader title="Project Management" description="Oversee all projects in the system." />
      <Card>
        <CardHeader className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Input 
              placeholder="Search by project name..."
              onChange={(e) => {
                  const term = e.target.value;
                  setFilters(prev => ({ ...prev, searchTerm: term }));
              }}
              className="max-w-sm"
            />
            <Button asChild>
                <Link href="/dashboard/admin/project-board">
                    <LibraryBig className="mr-2 h-4 w-4"/> View on Board
                </Link>
            </Button>
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
      
      {editingProject && <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent className="sm:max-w-lg">
            <SheetHeader><SheetTitle>Edit Project: {editingProject.name}</SheetTitle><SheetDescription>Make changes to the project details here.</SheetDescription></SheetHeader>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                <Input {...form.register('name')} placeholder="Project Name"/>
                <Textarea {...form.register('description')} placeholder="Description"/>
                <Input {...form.register('clientInfo')} placeholder="Client Info"/>
                <Input {...form.register('imageUrl')} placeholder="Image URL"/>
                <Input {...form.register('budget')} type="number" placeholder="Budget"/>
                <Controller name="dueDate" control={form.control} render={({ field }) => (
                     <Popover>
                        <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : "Due Date"}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent>
                     </Popover>
                )}/>
                <div className="flex justify-end gap-2 pt-4">
                    <SheetClose asChild><Button type="button" variant="outline">Cancel</Button></SheetClose>
                    <Button type="submit" disabled={form.formState.isSubmitting}>Save Changes</Button>
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
