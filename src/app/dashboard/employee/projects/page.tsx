
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Project {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  taskCount: number;
}

// Mock data for projects
const mockProjects: Project[] = [
  { id: "proj1", name: "Downtown Office Build", description: "Complete interior setup for the new downtown office.", imageUrl: "https://placehold.co/600x400.png", taskCount: 5, dataAiHint: "construction office" },
  { id: "proj2", name: "Residential Complex Maintenance", description: "Routine maintenance checks for the residential complex.", imageUrl: "https://placehold.co/600x400.png", taskCount: 12, dataAiHint: "apartment building" },
  { id: "proj3", name: "City Park Landscaping", description: "Landscaping and planting for the new city park.", imageUrl: "https://placehold.co/600x400.png", taskCount: 8, dataAiHint: "park landscape" },
];

export default function EmployeeProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Assigned Projects" description="Select a project to view and manage your tasks." />
      
      {mockProjects.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Briefcase className="mx-auto h-12 w-12 mb-4" />
            <p className="font-semibold">No projects assigned yet.</p>
            <p>Please check back later or contact your supervisor.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((project) => (
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
              <CardHeader>
                <CardTitle className="font-headline text-xl">{project.name}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  {project.taskCount} task{project.taskCount !== 1 ? 's' : ''} assigned.
                </p>
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
