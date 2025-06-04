
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw } from "lucide-react";
import Image from "next/image";
import type { Task, TaskStatus } from '@/types/database'; // Using combined Task type
import { fetchTasksForSupervisor, FetchTasksFilters } from '@/app/actions/supervisor/fetchTasks';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// TODO: Replace with actual data fetching for employees and projects for names
const mockEmployeesLookup: Record<string, { name: string, avatar: string }> = {
  "emp1": { name: "Alice Smith", avatar: "https://placehold.co/40x40.png?text=AS" },
  "emp2": { name: "Bob Johnson", avatar: "https://placehold.co/40x40.png?text=BJ" },
  "emp3": { name: "Carol White", avatar: "https://placehold.co/40x40.png?text=CW" },
  // Add more as needed if you have more employee IDs in Firestore tasks
};

const mockProjectsLookup: Record<string, { name: string }> = {
  "proj1": { name: "Downtown Office Build" },
  "proj2": { name: "Residential Complex Maintenance" },
  "proj3": { name: "City Park Landscaping" },
  // Add more as needed
};


export default function TaskMonitorPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); // For client-side filtering after fetch
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const { toast } = useToast();

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    const filters: FetchTasksFilters = {};
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    if (projectFilter !== "all") {
      filters.projectId = projectFilter;
    }

    const result = await fetchTasksForSupervisor(filters);
    if (result.success && result.tasks) {
      setTasks(result.tasks);
    } else {
      toast({
        title: "Error fetching tasks",
        description: result.message || "Could not load tasks.",
        variant: "destructive",
      });
      setTasks([]); // Clear tasks on error
    }
    setIsLoading(false);
  }, [statusFilter, projectFilter, toast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Client-side search on already fetched & filtered tasks
  const searchedTasks = tasks.filter(task => {
    const employeeName = mockEmployeesLookup[task.assignedEmployeeId]?.name || task.assignedEmployeeId;
    return (
      task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employeeName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  
  const uniqueProjectIdsInTasks = ["all", ...new Set(tasks.map(task => task.projectId))];
  const taskStatuses: (TaskStatus | "all")[] = ["all", "pending", "in-progress", "paused", "completed", "compliance-check", "needs-review", "verified", "rejected"];

  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
      case 'verified':
        return 'default'; 
      case 'in-progress':
        return 'secondary';
      case 'needs-review':
      case 'compliance-check':
        return 'outline'; 
      case 'pending':
      case 'paused':
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

   const getStatusBadgeClassName = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
      case 'verified':
        return 'bg-green-500 text-white';
      case 'needs-review':
      case 'compliance-check':
        return 'border-yellow-500 text-yellow-600';
      default:
        return '';
    }
  };


  return (
    <div className="space-y-6">
      <PageHeader 
        title="Task Monitor" 
        description="Oversee and track the status of all assigned tasks."
        actions={<Button onClick={loadTasks} variant="outline" disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Tasks</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Filters</CardTitle>
          <CardDescription>Refine the task list. Filters are applied on refresh.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search loaded tasks..." // Search is client-side for now
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                {uniqueProjectIdsInTasks.map(projId => (
                  <SelectItem key={projId} value={projId}>
                    {projId === "all" ? "All Projects" : (mockProjectsLookup[projId]?.name || projId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {taskStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status === "all" ? "All Statuses" : status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Task List</CardTitle>
          <CardDescription>Showing {searchedTasks.length} of {tasks.length} tasks matching current server filters. Search applied client-side.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading tasks...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchedTasks.length > 0 ? searchedTasks.map((task) => {
                  const employeeDetails = mockEmployeesLookup[task.assignedEmployeeId] || { name: task.assignedEmployeeId, avatar: "https://placehold.co/40x40.png?text=?" };
                  const projectDetails = mockProjectsLookup[task.projectId] || { name: task.projectId };
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Image src={employeeDetails.avatar} alt={employeeDetails.name} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar" />
                          <span className="font-medium">{employeeDetails.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{task.taskName}</TableCell>
                      <TableCell>{projectDetails.name}</TableCell>
                      <TableCell>{task.dueDate ? format(new Date(task.dueDate as string), "PP") : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(task.status)}
                          className={getStatusBadgeClassName(task.status)}
                        >
                          {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View Details</Button>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No tasks match the current filters, or no tasks found for this supervisor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
