
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        return defaultToZero ? '₹0.00' : 'N/A';
    }
    return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
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

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);


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
                               ? (combinedProjectCost / (costData.budget ?? 1)) * 100 
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
                 <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4" />
                    <span>{summaryData.totalAssignedEmployees} Employee(s) Involved</span>
                </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* High-level Stat cards */}
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Tasks" value={summaryData.totalTasks} icon={ListChecks} description={`${totalVerifiedOrCompletedTasks} completed`} />
        <StatCard title="Completion" value={`${summaryData.taskCompletionPercentage.toFixed(1)}%`} icon={CheckCircle} description="Of all tasks" />
        <StatCard title="Total Cost" value={formatCurrency(combinedProjectCost)} icon={DollarSign} description={`Budget: ${formatCurrency(costData.budget)}`} />
        <StatCard title={isOverBudget ? "Over Budget" : "Budget Remaining"} value={formatCurrency(remainingBudget)} icon={isOverBudget ? AlertTriangle : BarChartHorizontalBig} description={`${budgetUsedDisplay}% used`} />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content: All Tasks Table */}
        <div className="lg:col-span-2">
            <Card className="shadow-md h-full">
                <CardHeader>
                <CardTitle className="font-headline flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>All Project Tasks</CardTitle>
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
        </div>
        
        {/* Right Sidebar: Tabs for Timesheet, Inventory, Expenses */}
        <div className="lg:col-span-1">
            <Tabs defaultValue="timesheet" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                </TabsList>

                <TabsContent value="timesheet">
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center"><Hourglass className="mr-2 h-5 w-5 text-primary"/>Timesheet</CardTitle>
                            <CardDescription>Total Labor Cost: {formatCurrency(totalLaborCost)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                        {timesheetData.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">No timesheet data available.</p>
                        ) : (
                            <Table>
                                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Time</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {timesheetData.map(entry => (
                                        <TableRow key={entry.employeeId}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8"><AvatarImage src={entry.employeeAvatar} data-ai-hint="employee avatar"/><AvatarFallback>{entry.employeeName.substring(0,1)}</AvatarFallback></Avatar>
                                                    <span className="font-medium text-sm">{entry.employeeName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-sm">{formatDuration(entry.totalTimeSpentSeconds)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="inventory">
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center"><Archive className="mr-2 h-5 w-5 text-primary"/>Inventory</CardTitle>
                            <CardDescription>Material Cost: {formatCurrency(dynamicMaterialCost)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!inventoryData || inventoryData.items.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No inventory items found.</p>
                            ) : (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {inventoryData.items.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium text-sm">{item.itemName}</TableCell>
                                                <TableCell className="text-right text-sm">{item.quantity} {item.unit === 'custom' ? item.customUnitLabel : item.unit}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="expenses">
                     <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center"><ShoppingCart className="mr-2 h-5 w-5 text-primary"/>Expenses</CardTitle>
                            <CardDescription>Approved Expenses: {formatCurrency(totalApprovedEmployeeExpenses)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!expenseReportData || expenseReportData.totalApprovedEmployeeExpenses === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No approved expenses found.</p>
                            ) : (
                                <div className="space-y-3">
                                    {expenseBreakdownItems.filter(item => item.amount > 0).map(item => (
                                        <div key={item.type} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <item.icon className={`w-4 h-4 ${item.color}`} />
                                                <span>{item.type}</span>
                                            </div>
                                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
  );
}
