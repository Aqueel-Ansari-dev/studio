
"use client";

import { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ListFilter, Search } from "lucide-react";
import Image from "next/image";
import type { TaskStatus, UserRole } from '@/types/database';

interface MonitoredTask {
  id: string;
  taskName: string;
  projectName: string;
  employeeName: string;
  employeeAvatar: string;
  status: TaskStatus;
  dueDate: string;
}

// Mock data for tasks to monitor
const mockMonitoredTasks: MonitoredTask[] = [
  { id: "task_m1", taskName: "Install Workstations", projectName: "Downtown Office Build", employeeName: "Alice Smith", employeeAvatar: "https://placehold.co/40x40.png?text=AS", status: "in-progress", dueDate: "2024-08-15" },
  { id: "task_m2", taskName: "HVAC Unit Inspection", projectName: "Residential Complex Maintenance", employeeName: "Bob Johnson", employeeAvatar: "https://placehold.co/40x40.png?text=BJ", status: "completed", dueDate: "2024-08-10" },
  { id: "task_m3", taskName: "Plant Trees - Zone 1", projectName: "City Park Landscaping", employeeName: "Carol White", employeeAvatar: "https://placehold.co/40x40.png?text=CW", status: "paused", dueDate: "2024-08-20" },
  { id: "task_m4", taskName: "Network Cabling", projectName: "Downtown Office Build", employeeName: "David Brown", employeeAvatar: "https://placehold.co/40x40.png?text=DB", status: "needs-review", dueDate: "2024-08-05" },
  { id: "task_m5", taskName: "Client Meeting Prep", projectName: "Project Alpha", employeeName: "Eve Davis", employeeAvatar: "https://placehold.co/40x40.png?text=ED", status: "pending", dueDate: "2024-08-25" },
  { id: "task_m6", taskName: "Safety Equipment Check", projectName: "Industrial Site Audit", employeeName: "Frank Green", employeeAvatar: "https://placehold.co/40x40.png?text=FG", status: "verified", dueDate: "2024-07-30" },
];

export default function TaskMonitorPage() {
  const [tasks, setTasks] = useState<MonitoredTask[]>(mockMonitoredTasks);
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");

  // In a real app, filtering would likely be done server-side or with more optimized client-side logic
  const filteredTasks = tasks
    .filter(task => 
      task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(task => projectFilter === "all" || task.projectName === projectFilter)
    .filter(task => statusFilter === "all" || task.status === statusFilter);

  const uniqueProjects = ["all", ...new Set(mockMonitoredTasks.map(task => task.projectName))];
  const taskStatuses: (TaskStatus | "all")[] = ["all", "pending", "in-progress", "paused", "completed", "compliance-check", "needs-review", "verified", "rejected"];

  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
      case 'verified':
        return 'default'; // default is usually primary, often green-ish
      case 'in-progress':
        return 'secondary';
      case 'needs-review':
      case 'compliance-check':
        return 'outline'; // Often yellow/orange
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
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Filters</CardTitle>
          <CardDescription>Refine the task list using the filters below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by task or employee..."
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
                {uniqueProjects.map(proj => (
                  <SelectItem key={proj} value={proj}>{proj === "all" ? "All Projects" : proj}</SelectItem>
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
          <CardDescription>Showing {filteredTasks.length} of {tasks.length} tasks.</CardDescription>
        </CardHeader>
        <CardContent>
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
              {filteredTasks.length > 0 ? filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Image src={task.employeeAvatar} alt={task.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar" />
                      <span className="font-medium">{task.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{task.taskName}</TableCell>
                  <TableCell>{task.projectName}</TableCell>
                  <TableCell>{task.dueDate}</TableCell>
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
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No tasks match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
