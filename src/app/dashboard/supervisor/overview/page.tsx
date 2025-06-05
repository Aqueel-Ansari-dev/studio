
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, ListChecks, CheckCircle, Clock, AlertTriangle, PlusCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface TeamMemberTask {
  id: string;
  employeeName: string;
  employeeAvatar: string;
  taskName: string;
  projectId: string; // Added projectId
  projectName: string;
  status: 'pending' | 'in-progress' | 'paused' | 'completed' | 'needs-review';
  lastUpdate: string; // e.g., "2 hours ago" or a timestamp
}

const mockTeamTasks: TeamMemberTask[] = [
  { id: "tt1", employeeName: "Alice Smith", employeeAvatar: "https://placehold.co/40x40.png?text=AS", taskName: "Install Workstations", projectId: "projectA", projectName: "Downtown Office Build", status: "in-progress", lastUpdate: "30 mins ago" },
  { id: "tt2", employeeName: "Bob Johnson", employeeAvatar: "https://placehold.co/40x40.png?text=BJ", taskName: "HVAC Unit Inspection", projectId: "projectB", projectName: "Residential Complex Maintenance", status: "completed", lastUpdate: "1 day ago" },
  { id: "tt3", employeeName: "Carol White", employeeAvatar: "https://placehold.co/40x40.png?text=CW", taskName: "Plant Trees - Zone 1", projectId: "projectC", projectName: "City Park Landscaping", status: "paused", lastUpdate: "4 hours ago" },
  { id: "tt4", employeeName: "David Brown", employeeAvatar: "https://placehold.co/40x40.png?text=DB", taskName: "Network Cabling", projectId: "projectA", projectName: "Downtown Office Build", status: "needs-review", lastUpdate: "1 hour ago" },
  { id: "tt5", employeeName: "Eve Davis", employeeAvatar: "https://placehold.co/40x40.png?text=ED", taskName: "Client Meeting Prep", projectId: "projectD", projectName: "Project Alpha", status: "pending", lastUpdate: "2 days ago" },
];

const mockStats = {
  totalTasks: 25,
  completedTasks: 15,
  inProgressTasks: 5,
  pendingTasks: 3,
  needsReviewTasks: 2,
};

export default function SupervisorOverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Supervisor Dashboard" 
        description="Monitor team progress and manage tasks."
        actions={
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/dashboard/supervisor/assign-task">
              <PlusCircle className="mr-2 h-4 w-4" /> Assign New Task
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.needsReviewTasks}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Live Team Progress</CardTitle>
          <CardDescription>Overview of ongoing and recently updated tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Update</TableHead>
                {/* <TableHead className="text-right">Actions</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTeamTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Image src={task.employeeAvatar} alt={task.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                      <span className="font-medium">{task.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{task.taskName}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/supervisor/projects/${task.projectId}`} className="text-primary hover:underline">
                      {task.projectName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      task.status === 'completed' ? 'default' :
                      task.status === 'in-progress' ? 'secondary' :
                      task.status === 'needs-review' ? 'outline' :
                      'destructive'
                    } className={
                      task.status === 'completed' ? 'bg-green-500 text-white' :
                      task.status === 'needs-review' ? 'border-yellow-500 text-yellow-600' : ''
                    }>
                      {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </TableCell>
                  <TableCell>{task.lastUpdate}</TableCell>
                  {/* <TableCell className="text-right">
                    <Button variant="ghost" size="sm" disabled>View Details</Button>
                  </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
