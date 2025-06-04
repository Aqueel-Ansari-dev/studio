
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw } from "lucide-react";
import Image from "next/image";
import type { Task, TaskStatus } from '@/types/database';
import { fetchTasksForSupervisor, FetchTasksFilters } from '@/app/actions/supervisor/fetchTasks';
import { fetchUsersByRole, UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function TaskMonitorPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true); // For employees and projects

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const { toast } = useToast();

  const employeeMap = useMemo(() => {
    return new Map(employees.map(emp => [emp.id, emp]));
  }, [employees]);

  const projectMap = useMemo(() => {
    return new Map(projects.map(proj => [proj.id, proj]));
  }, [projects]);

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [fetchedEmployees, fetchedProjects] = await Promise.all([
        fetchUsersByRole('employee'),
        fetchAllProjects()
      ]);
      setEmployees(fetchedEmployees);
      setProjects(fetchedProjects);
    } catch (error) {
      toast({
        title: "Error fetching lookup data",
        description: "Could not load employees or projects.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);
  
  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
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
      setTasks([]);
    }
    setIsLoadingTasks(false);
  }, [statusFilter, projectFilter, toast]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // Load tasks only after lookups are done or if lookups are not loading
    // This prevents trying to map IDs before names are available
    if (!isLoadingLookups) {
        loadTasks();
    }
  }, [loadTasks, isLoadingLookups]);

  const searchedTasks = tasks.filter(task => {
    const employeeName = employeeMap.get(task.assignedEmployeeId)?.name || task.assignedEmployeeId;
    const projectName = projectMap.get(task.projectId)?.name || task.projectId;
    return (
      task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      projectName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  
  const taskStatuses: (TaskStatus | "all")[] = ["all", "pending", "in-progress", "paused", "completed", "compliance-check", "needs-review", "verified", "rejected"];

  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'default'; 
      case 'in-progress': return 'secondary';
      case 'needs-review': case 'compliance-check': return 'outline'; 
      case 'pending': case 'paused': case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

   const getStatusBadgeClassName = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'bg-green-500 text-white';
      case 'needs-review': case 'compliance-check': return 'border-yellow-500 text-yellow-600';
      default: return '';
    }
  };

  const isLoading = isLoadingTasks || isLoadingLookups;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Task Monitor" 
        description="Oversee and track the status of all assigned tasks."
        actions={<Button onClick={loadTasks} variant="outline" disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoadingTasks ? 'animate-spin' : ''}`} /> Refresh Tasks</Button>}
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
                placeholder="Search loaded tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter} disabled={isLoading || projects.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingLookups ? "Loading projects..." : "Filter by project"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(proj => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
                 {(!isLoadingLookups && projects.length === 0) && <SelectItem value="no-projects" disabled>No projects found</SelectItem>}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")} disabled={isLoading}>
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
          <CardDescription>
            Showing {searchedTasks.length} task(s). 
            {searchTerm && ` (Filtered by search term "${searchTerm}")`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading data...</p>
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
                  const employee = employeeMap.get(task.assignedEmployeeId);
                  const project = projectMap.get(task.projectId);
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Image src={employee?.avatar || "https://placehold.co/40x40.png?text=?"} alt={employee?.name || task.assignedEmployeeId} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar" />
                          <span className="font-medium">{employee?.name || task.assignedEmployeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell>{task.taskName}</TableCell>
                      <TableCell>{project?.name || task.projectId}</TableCell>
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
                      No tasks match the current filters, or no tasks found.
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
