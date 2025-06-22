
"use client";

import type { ProjectSummaryData, ProjectTimesheetEntry, ProjectCostBreakdownData } from '@/app/actions/projects/projectDetailsActions';
import type { ProjectInventoryDetails, InventoryItemWithTotalCost } from '@/app/actions/inventory-expense/getInventoryByProject';
import type { ProjectExpenseReportData } from '@/app/actions/inventory-expense/getProjectExpenseReport';
import type { UserBasic } from '@/app/actions/common/fetchAllUsersBasic';
import type { TaskStatus } from '@/types/database';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  AlertTriangle, Briefcase, CalendarDays, CheckCircle, ClipboardList, 
  DollarSign, Users, Clock, Hourglass, BarChartHorizontalBig, Archive, 
  ShoppingCart, ListFilter, Plane, Utensils, Wrench, ShoppingBag, ListChecks 
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

interface ProjectDetailsViewProps {
  summaryData: ProjectSummaryData;
  timesheetData: ProjectTimesheetEntry[];
  costData: ProjectCostBreakdownData;
  inventoryData?: ProjectInventoryDetails;
  expenseReportData?: ProjectExpenseReportData;
  allUsers?: UserBasic[];
}

const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

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

const getTaskStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'default';
      case 'in-progress': return 'secondary';
      case 'needs-review': return 'outline';
      case 'pending': case 'paused': case 'rejected': return 'destructive';
      default: return 'outline';
    }
};

const getTaskStatusBadgeClassName = (status: TaskStatus) => {
    switch (status) {
      case 'completed': case 'verified': return 'bg-green-500 text-white';
      case 'needs-review': return 'border-yellow-500 text-yellow-600';
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      default: return '';
    }
};

export function ProjectDetailsView({ summaryData, timesheetData, costData, inventoryData, expenseReportData, allUsers = [] }: ProjectDetailsViewProps) {
  const { project, tasks } = summaryData;

  const userMap = useMemo(() => {
    return new Map(allUsers.map(user => [user.id, user.name]));
  }, [allUsers]);

  // Calculate combined project cost using the most direct sources
  const dynamicMaterialCost = inventoryData?.totalInventoryCost ?? costData.materialCost ?? 0;
  const totalApprovedEmployeeExpenses = expenseReportData?.totalApprovedEmployeeExpenses ?? 0;
  const totalLaborCost = costData.totalLaborCost ?? 0;
  
  const combinedProjectCost = dynamicMaterialCost + totalLaborCost + totalApprovedEmployeeExpenses;
  const remainingBudget = (costData.budget ?? 0) - combinedProjectCost;
  const budgetUsedPercentage = (costData.budget ?? 0) > 0 
                               ? (combinedProjectCost / (costData.budget ?? 1)) * 100 // Avoid division by zero if budget is 0
                               : (combinedProjectCost > 0 ? Infinity : 0);
  
  const budgetUsedDisplay = budgetUsedPercentage === Infinity ? ">100" : budgetUsedPercentage.toFixed(1);
  const isOverBudget = (costData.budget ?? 0) > 0 && combinedProjectCost > (costData.budget ?? 0);

  const totalVerifiedOrCompletedTasks = summaryData.completedTasks + summaryData.verifiedTasks;

  const expenseBreakdownItems = expenseReportData ? [
    { type: 'Travel', amount: expenseReportData.breakdownByType.travel, icon: Plane, color: "text-blue-500" },
    { type: 'Food', amount: expenseReportData.breakdownByType.food, icon: Utensils, color: "text-orange-500" },
    { type: 'Tools', amount: expenseReportData.breakdownByType.tools, icon: Wrench, color: "text-gray-500" },
    { type: 'Other', amount: expenseReportData.breakdownByType.other, icon: ShoppingBag, color: "text-purple-500" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Project Overview Card */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start gap-4">
            {project?.imageUrl ? (
                 <div className="relative h-32 w-full sm:h-24 sm:w-36 rounded-md overflow-hidden flex-shrink-0">
                    <Image 
                        src={project.imageUrl} 
                        alt={project.name || 'Project Image'} 
                        layout="fill" 
                        objectFit="cover"
                        data-ai-hint={project.dataAiHint || "project overview"}
                    />
                 </div>
            ) : (
                 <div className="relative h-32 w-full sm:h-24 sm:w-36 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-12 h-12 text-muted-foreground" />
                </div>
            )}
          <div className="flex-grow">
            <CardTitle className="text-2xl font-headline">{project?.name || "N/A"}</CardTitle>
            <CardDescription className="mt-1">{project?.description || "No description available."}</CardDescription>
             <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {project?.dueDate && (
                    <div className="flex items-center">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>Due: {format(new Date(project.dueDate), "PP")}</span>
                    </div>
                )}
                <div className="flex items-center">
                    <DollarSign className="mr-2 h-4 w-4" />
                    <span>Budget: {formatCurrency(costData.budget)}</span>
                </div>
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

        {/* Cost & Budget Overview Card (using new combined costs) */}
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5 text-primary"/>Cost & Budget Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Budget:</p>
                <p className="font-semibold text-lg">{formatCurrency(costData.budget)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Material Cost:</p>
                <p className="font-semibold text-lg">{formatCurrency(dynamicMaterialCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Labor Cost:</p>
                <p className="font-semibold text-lg">{formatCurrency(totalLaborCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Employee Expenses:</p>
                <p className="font-semibold text-lg">{formatCurrency(totalApprovedEmployeeExpenses)}</p>
              </div>
              <div className="md:col-span-2">
                <p className="font-bold text-muted-foreground">Total Project Cost:</p>
                <p className={`font-bold text-xl ${isOverBudget ? 'text-destructive' : 'text-green-600'}`}>
                  {formatCurrency(combinedProjectCost)}
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
                value={(costData.budget ?? 0) > 0 ? Math.min(budgetUsedPercentage, 100) : (combinedProjectCost > 0 ? 100 : 0) } 
                aria-label={`Budget used ${budgetUsedDisplay}%`}
                className={isOverBudget ? '[&>div]:bg-destructive' : ''} 
              />
            </div>
            
            <div className={`mt-3 p-3 rounded-md text-center ${isOverBudget ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-700'}`}>
              {isOverBudget ? (
                <div className="flex items-center justify-center">
                  <AlertTriangle className="mr-2 h-5 w-5" /> 
                  <span className="font-semibold">Over Budget by {formatCurrency(Math.abs(remainingBudget))}</span>
                </div>
              ) : (
                 <div className="flex items-center justify-center">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    <span className="font-semibold">Remaining Budget: {formatCurrency(remainingBudget)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* All Tasks Table */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>All Project Tasks</CardTitle>
          <CardDescription>A complete list of all tasks associated with this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No tasks have been created for this project yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Name</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.taskName}</TableCell>
                      <TableCell>{userMap.get(task.assignedEmployeeId) || 'Unassigned'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={getTaskStatusBadgeVariant(task.status)}
                          className={getTaskStatusBadgeClassName(task.status)}
                        >
                          {task.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.dueDate ? format(new Date(task.dueDate), "PP") : 'N/A'}</TableCell>
                      <TableCell>{task.updatedAt ? formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true }) : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Inventory Details Table */}
      {inventoryData && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><Archive className="mr-2 h-5 w-5 text-primary"/>Project Inventory</CardTitle>
            <CardDescription>Total Material Cost: {formatCurrency(inventoryData.totalInventoryCost)}</CardDescription>
          </CardHeader>
          <CardContent>
            {inventoryData.items.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No inventory items found for this project.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Cost/Unit</TableHead>
                    <TableHead className="text-right">Total Item Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryData.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell>{item.unit === 'custom' ? item.customUnitLabel : item.unit.toUpperCase()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.costPerUnit)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.totalItemCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Employee Expense Report Card */}
      {expenseReportData && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><ShoppingCart className="mr-2 h-5 w-5 text-primary"/>Employee Expense Report</CardTitle>
            <CardDescription>Total Approved Employee Expenses: {formatCurrency(expenseReportData.totalApprovedEmployeeExpenses)}</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseReportData.totalApprovedEmployeeExpenses === 0 ? (
                 <p className="text-muted-foreground text-center py-4">No approved employee expenses for this project yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {expenseBreakdownItems.map((item) => (
                  <Card key={item.type} className="flex flex-col items-center justify-center p-4 text-center bg-muted/50">
                    <item.icon className={`w-8 h-8 mb-2 ${item.color}`} />
                    <p className="text-sm font-medium text-muted-foreground">{item.type}</p>
                    <p className="text-lg font-semibold">{formatCurrency(item.amount)}</p>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Timesheet Table */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Hourglass className="mr-2 h-5 w-5 text-primary"/>Project Timesheet</CardTitle>
          <CardDescription>Total Labor Cost: {formatCurrency(totalLaborCost)}</CardDescription>
        </CardHeader>
        <CardContent>
          {timesheetData.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No timesheet data available for this project yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] sm:w-[80px]">Avatar</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="hidden md:table-cell">Pay Mode</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Rate</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead className="text-right">Time Spent</TableHead>
                  <TableHead className="text-right">Labor Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheetData.map((entry) => (
                  <TableRow key={entry.employeeId}>
                    <TableCell>
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                        <AvatarImage src={entry.employeeAvatar} alt={entry.employeeName} data-ai-hint="employee avatar"/>
                        <AvatarFallback>{entry.employeeName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{entry.employeeName}</TableCell>
                    <TableCell className="hidden md:table-cell">{getPayModeLabel(entry.payMode)}</TableCell>
                    <TableCell className="hidden md:table-cell text-right">{entry.payMode === 'not_set' ? 'N/A' : (entry.payMode === 'hourly' || entry.payMode === 'daily' ? formatCurrency(entry.rate, false) : 'N/A')}</TableCell>
                    <TableCell className="text-right">{entry.taskCount}</TableCell>
                    <TableCell className="text-right">{formatDuration(entry.totalTimeSpentSeconds)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(entry.calculatedLaborCost)}</TableCell>
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
