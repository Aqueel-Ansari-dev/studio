
"use client";

import type { ProjectSummaryData, ProjectTimesheetEntry, ProjectCostBreakdownData } from '@/app/actions/projects/projectDetailsActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Briefcase, CalendarDays, CheckCircle, ClipboardList, DollarSign, Users, Clock, Hourglass, BarChartHorizontalBig } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';

interface ProjectDetailsViewProps {
  summaryData: ProjectSummaryData;
  timesheetData: ProjectTimesheetEntry[];
  costData: ProjectCostBreakdownData;
}

// Helper function to format duration from seconds to HH:MM:SS
const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Helper function to format currency
const formatCurrency = (amount: number | undefined, defaultToZero: boolean = true): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return defaultToZero ? '$0.00' : 'N/A';
    }
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const getPayModeLabel = (payMode: string | undefined): string => {
    if (!payMode || payMode === 'not_set') return 'Not Set';
    return payMode.charAt(0).toUpperCase() + payMode.slice(1);
}


export function ProjectDetailsView({ summaryData, timesheetData, costData }: ProjectDetailsViewProps) {
  const { project } = summaryData;

  const budgetUsedDisplay = costData.budgetUsedPercentage === Infinity ? ">100" : costData.budgetUsedPercentage.toFixed(1);
  const isOverBudget = costData.budget > 0 && costData.totalProjectCost > costData.budget;

  const totalVerifiedOrCompletedTasks = summaryData.completedTasks + summaryData.verifiedTasks;

  return (
    <div className="space-y-6">
      {/* Project Overview Card */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
            {project?.imageUrl ? (
                 <div className="relative h-24 w-36 rounded-md overflow-hidden flex-shrink-0">
                    <Image 
                        src={project.imageUrl} 
                        alt={project.name || 'Project Image'} 
                        layout="fill" 
                        objectFit="cover"
                        data-ai-hint={project.dataAiHint || "project overview"}
                    />
                 </div>
            ) : (
                 <div className="relative h-24 w-36 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-12 h-12 text-muted-foreground" />
                </div>
            )}
          <div className="flex-grow">
            <CardTitle className="text-2xl font-headline">{project?.name || "N/A"}</CardTitle>
            <CardDescription className="mt-1">{project?.description || "No description available."}</CardDescription>
             <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {project?.dueDate && (
                    <div className="flex items-center">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>Due: {format(new Date(project.dueDate), "PP")}</span>
                    </div>
                )}
                <div className="flex items-center">
                    <DollarSign className="mr-2 h-4 w-4" />
                    <span>Budget: {formatCurrency(project?.budget)}</span>
                </div>
                 {project?.materialCost !== undefined && (
                    <div className="flex items-center">
                        <DollarSign className="mr-2 h-4 w-4 text-orange-500" />
                        <span>Material Cost: {formatCurrency(project.materialCost)}</span>
                    </div>
                 )}
                 {project?.createdAt && (
                    <div className="flex items-center">
                        <CalendarDays className="mr-2 h-4 w-4 text-blue-500" />
                        <span>Created: {format(new Date(project.createdAt), "PP")}</span>
                    </div>
                 )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Summary Card */}
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>Task Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Tasks:</span>
              <Badge variant="secondary">{summaryData.totalTasks}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Completed/Verified:</span>
              <Badge className="bg-green-500 text-white hover:bg-green-600">{totalVerifiedOrCompletedTasks}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">In Progress:</span>
               <Badge className="bg-blue-500 text-white hover:bg-blue-600">{summaryData.inProgressTasks}</Badge>
            </div>
             <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pending:</span>
               <Badge variant="outline">{summaryData.pendingTasks}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Needs Review:</span>
               <Badge className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10">{summaryData.needsReviewTasks}</Badge>
            </div>
             <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Rejected:</span>
               <Badge variant="destructive">{summaryData.rejectedTasks}</Badge>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Completion:</span>
                <span className="font-semibold">{summaryData.taskCompletionPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={summaryData.taskCompletionPercentage} aria-label={`${summaryData.taskCompletionPercentage.toFixed(1)}% completed`} />
            </div>
             <div className="flex items-center text-sm text-muted-foreground pt-2">
                <Users className="mr-2 h-4 w-4"/>
                <span>{summaryData.totalAssignedEmployees} Employee(s) Involved</span>
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown Card */}
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary"/>Cost & Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Original Budget:</p>
                <p className="font-semibold text-lg">{formatCurrency(costData.budget)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Material Cost:</p>
                <p className="font-semibold text-lg">{formatCurrency(costData.materialCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Labor Cost:</p>
                <p className="font-semibold text-lg">{formatCurrency(costData.totalLaborCost)}</p>
              </div>
              <div>
                <p className="font-bold text-muted-foreground">Total Project Cost:</p>
                <p className={`font-bold text-xl ${isOverBudget ? 'text-destructive' : 'text-green-600'}`}>
                  {formatCurrency(costData.totalProjectCost)}
                </p>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Budget Used:</span>
                <span className={`font-semibold ${isOverBudget ? 'text-destructive' : ''}`}>
                  {budgetUsedDisplay}%
                </span>
              </div>
              <Progress 
                value={costData.budget > 0 ? Math.min(costData.budgetUsedPercentage, 100) : (costData.totalProjectCost > 0 ? 100 : 0) } 
                aria-label={`Budget used ${budgetUsedDisplay}%`}
                className={isOverBudget ? '[&>div]:bg-destructive' : ''} 
              />
            </div>
            
            <div className={`mt-3 p-3 rounded-md text-center ${isOverBudget ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-700'}`}>
              {isOverBudget ? (
                <div className="flex items-center justify-center">
                  <AlertTriangle className="mr-2 h-5 w-5" /> 
                  <span className="font-semibold">Over Budget by {formatCurrency(Math.abs(costData.remainingBudget))}</span>
                </div>
              ) : (
                 <div className="flex items-center justify-center">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    <span className="font-semibold">Remaining Budget: {formatCurrency(costData.remainingBudget)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timesheet Table */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Hourglass className="mr-2 h-5 w-5 text-primary"/>Project Timesheet</CardTitle>
        </CardHeader>
        <CardContent>
          {timesheetData.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No timesheet data available for this project yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Avatar</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay Mode</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Time Spent</TableHead>
                  <TableHead className="text-right">Labor Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheetData.map((entry) => (
                  <TableRow key={entry.employeeId}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={entry.employeeAvatar} alt={entry.employeeName} data-ai-hint="employee avatar"/>
                        <AvatarFallback>{entry.employeeName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{entry.employeeName}</TableCell>
                    <TableCell>{getPayModeLabel(entry.payMode)}</TableCell>
                    <TableCell>{entry.payMode === 'not_set' ? 'N/A' : (entry.payMode === 'hourly' || entry.payMode === 'daily' ? formatCurrency(entry.rate, false) : 'N/A')}</TableCell>
                    <TableCell>{entry.taskCount}</TableCell>
                    <TableCell>{formatDuration(entry.totalTimeSpentSeconds)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.calculatedLaborCost)}</TableCell>
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
