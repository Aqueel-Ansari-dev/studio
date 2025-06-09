
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { fetchMyAssignedProjects, ProjectWithId, FetchMyAssignedProjectsResult } from '@/app/actions/employee/fetchEmployeeData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

export default function EmployeeProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadProjects = useCallback(async () => {
    if (!user || !user.id) {
      if (!authLoading) { // Only show toast if auth is not loading and user is still not available
         toast({
          title: "Authentication Error",
          description: "Could not load projects: User not found.",
          variant: "destructive",
        });
        setProjects([]); // Ensure projects is an array
        setIsLoading(false);
      }
      return;
    }
    
    setIsLoading(true);
    try {
      const result: FetchMyAssignedProjectsResult = await fetchMyAssignedProjects(user.id);
      if (result.success && result.projects) {
        setProjects(result.projects);
      } else {
        setProjects([]); // Ensure projects is an array even if API call fails or returns no projects
        toast({
          title: "Error Loading Projects",
          description: result.error || "Could not load your projects.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Failed to fetch projects:", error);
      setProjects([]); // Ensure projects is an array on catch
      toast({
        title: "Error Loading Projects",
        description: error.message || "Could not load your projects. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, toast]);


  useEffect(() => {
    if (!authLoading && user?.id) {
        loadProjects();
    } else if (!authLoading && !user?.id) {
      // Handle case where auth is done loading but there's no user (e.g. logged out)
      setProjects([]);
      setIsLoading(false);
    }
  }, [user, authLoading, loadProjects]);

  if (isLoading || authLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Assigned Projects" description="Loading your projects..." />
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <RefreshCw className="mx-auto h-12 w-12 mb-4 animate-spin" />
            <p className="font-semibold">Loading projects...</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!user) {
     return (
      <div className="space-y-6">
        <PageHeader title="My Assigned Projects" description="Please log in to see your projects." />
         <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Briefcase className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold">Not Authenticated</p>
            <p>Please log in to view your assigned projects.</p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader title="My Assigned Projects" description="Select a project to view and manage your tasks." />
      
      {projects.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Briefcase className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold">No projects assigned yet.</p>
            <p>Please check back later or contact your supervisor if you believe this is an error.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
              {project.imageUrl && (
                 <div className="relative h-48 w-full">
                    <Image 
                        src={project.imageUrl} 
                        alt={project.name} 
                        layout="fill" 
                        objectFit="cover"
                        data-ai-hint={project.dataAiHint || "project image"}
                    />
                 </div>
              )}
              {!project.imageUrl && (
                <div className="relative h-48 w-full bg-muted flex items-center justify-center">
                  <Briefcase className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
              <CardHeader>
                <CardTitle className="font-headline text-xl">{project.name}</CardTitle>
                {project.description && <CardDescription className="mt-1 text-sm text-muted-foreground truncate-2-lines">{project.description}</CardDescription>}
              </CardHeader>
              <CardContent className="flex-grow">
                {/* taskCount display removed for now */}
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href={`/dashboard/employee/projects/${project.id}/tasks`}>
                    View Tasks <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper style for truncating description (optional, can be done with Tailwind JIT in globals.css if preferred)
const styles = `
.truncate-2-lines {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
