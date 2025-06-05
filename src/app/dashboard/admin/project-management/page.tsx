
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, RefreshCw, LibraryBig, Edit, Trash2, Eye } from "lucide-react"; // Added Eye icon
import Image from 'next/image';
import Link from 'next/link'; // Added Link import
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchProjectsForAdmin, type ProjectForAdminList } from '@/app/actions/admin/fetchProjectsForAdmin';
import { createProject, type CreateProjectInput, type CreateProjectResult } from '@/app/actions/admin/createProject';

export default function ProjectManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectForAdminList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);

  // Form state for new project
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectImageUrl, setNewProjectImageUrl] = useState('');
  const [newProjectDataAiHint, setNewProjectDataAiHint] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedProjects = await fetchProjectsForAdmin();
      setProjects(fetchedProjects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      toast({
        title: "Error Loading Projects",
        description: "Could not load projects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const resetForm = () => {
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectImageUrl('');
    setNewProjectDataAiHint('');
    setFormErrors({});
  }

  const handleAddProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setFormErrors({});

    const projectInput: CreateProjectInput = {
      name: newProjectName,
      description: newProjectDescription,
      imageUrl: newProjectImageUrl,
      dataAiHint: newProjectDataAiHint,
    };

    const result: CreateProjectResult = await createProject(user.id, projectInput);

    if (result.success) {
      toast({
        title: "Project Created!",
        description: `Project "${newProjectName}" has been successfully created.`,
      });
      resetForm();
      setShowAddProjectDialog(false);
      loadProjects(); // Refresh the list
    } else {
      if (result.errors) {
        const newErrors: Record<string, string | undefined> = {};
        result.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
        setFormErrors(newErrors);
        toast({
          title: "Validation Failed",
          description: "Please check the form for errors.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Creation Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Management"
        description="View, add, and manage projects in the system."
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
                    Fill in the details for the new project.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddProjectSubmit} className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="newProjectName">Project Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="newProjectName"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g., Downtown Office Renovation"
                      className="mt-1"
                    />
                    {formErrors.name && <p className="text-sm text-destructive mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="newProjectDescription">Description</Label>
                    <Textarea
                      id="newProjectDescription"
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="A brief description of the project..."
                      className="mt-1 min-h-[100px]"
                    />
                    {formErrors.description && <p className="text-sm text-destructive mt-1">{formErrors.description}</p>}
                  </div>
                  <div>
                    <Label htmlFor="newProjectImageUrl">Image URL</Label>
                    <Input
                      id="newProjectImageUrl"
                      type="url"
                      value={newProjectImageUrl}
                      onChange={(e) => setNewProjectImageUrl(e.target.value)}
                      placeholder="https://example.com/image.png"
                      className="mt-1"
                    />
                     {formErrors.imageUrl && <p className="text-sm text-destructive mt-1">{formErrors.imageUrl}</p>}
                  </div>
                   <div>
                    <Label htmlFor="newProjectDataAiHint">Data AI Hint (for image)</Label>
                    <Input
                      id="newProjectDataAiHint"
                      value={newProjectDataAiHint}
                      onChange={(e) => setNewProjectDataAiHint(e.target.value)}
                      placeholder="e.g., office building, construction site"
                      className="mt-1"
                    />
                    {formErrors.dataAiHint && <p className="text-sm text-destructive mt-1">{formErrors.dataAiHint}</p>}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                       <Button type="button" variant="outline" onClick={() => { resetForm(); setShowAddProjectDialog(false);}} disabled={isSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90">
                      {isSubmitting ? "Adding..." : "Add Project"}
                    </Button>
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
          <CardDescription>
            {isLoading ? "Loading projects..." : `Displaying ${projects.length} project(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No projects found. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Image
                        src={project.imageUrl || `https://placehold.co/100x60.png?text=${project.name.substring(0,3)}`}
                        alt={project.name}
                        width={100}
                        height={60}
                        className="rounded-md object-cover"
                        data-ai-hint={project.dataAiHint || "project image"}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{project.description || "N/A"}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="ghost" size="icon" title="View Details">
                         <Link href={`/dashboard/admin/projects/${project.id}`}>
                           <Eye className="h-4 w-4" />
                           <span className="sr-only">View Project Details</span>
                         </Link>
                       </Button>
                       <Button variant="ghost" size="icon" title="Edit Project" disabled> {/* Edit Project Metadata TBD */}
                         <Edit className="h-4 w-4" />
                         <span className="sr-only">Edit Project</span>
                       </Button>
                       <Button variant="ghost" size="icon" title="Delete Project" disabled className="text-destructive hover:text-destructive"> {/* Delete Project TBD */}
                         <Trash2 className="h-4 w-4" />
                         <span className="sr-only">Delete Project</span>
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    