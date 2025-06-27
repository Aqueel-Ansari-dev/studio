
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, RefreshCw, PlayCircle, ListOrdered, Users, BarChartBig, DollarSign, WalletCards, Download, ChevronDown } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { calculatePayrollForProject, type PayrollCalculationSummary } from '@/app/actions/payroll/payrollProcessing';
import { getPayrollRecordsForEmployee, getAllPayrollRecords, getPayrollSummaryForProject, type ProjectPayrollAggregatedSummary, type FetchPayrollRecordsResult } from '@/app/actions/payroll/fetchPayrollData';
import { exportPayrollHistoryToCSV } from '@/app/actions/payroll/exportPayrollData';
import { fetchAllProjects, type ProjectForSelection, type FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { fetchUsersByRole, type UserForSelection, type FetchUsersByRoleResult } from '@/app/actions/common/fetchUsersByRole';
import type { PayrollRecord } from '@/types/database';

const PAYROLL_RECORDS_PER_PAGE = 15;

const formatCurrency = (amount: number | undefined) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatDateSafe = (dateInput: string | Date | undefined, formatString: string = "PP"): string => {
  if (!dateInput) return "N/A";
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  return isValid(date) ? format(date, formatString) : "Invalid Date";
};


export default function AdminPayrollPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [runPayrollProjectId, setRunPayrollProjectId] = useState('');
  const [runPayrollStartDate, setRunPayrollStartDate] = useState<Date | undefined>(undefined);
  const [runPayrollEndDate, setRunPayrollEndDate] = useState<Date | undefined>(undefined);
  const [runPayrollLoading, setRunPayrollLoading] = useState(false);
  const [runPayrollResult, setRunPayrollResult] = useState<PayrollCalculationSummary[] | null>(null);

  const [historyEmployeeIdFilter, setHistoryEmployeeIdFilter] = useState('');
  const [historyRecordsLoading, setHistoryRecordsLoading] = useState(false);
  const [allLoadedHistoryRecords, setAllLoadedHistoryRecords] = useState<PayrollRecord[]>([]);
  const [lastHistoryCursor, setLastHistoryCursor] = useState<string | null | undefined>(undefined);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isFetchingMoreHistory, setIsFetchingMoreHistory] = useState(false);
  
  const [exportingCsv, setExportingCsv] = useState(false);

  const [summaryProjectIdInput, setSummaryProjectIdInput] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [projectPayrollSummary, setProjectPayrollSummary] = useState<ProjectPayrollAggregatedSummary | null>(null);
  
  const [allProjectsList, setAllProjectsList] = useState<ProjectForSelection[]>([]);
  const [allEmployeesList, setAllEmployeesList] = useState<UserForSelection[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);

  const projectMap = useMemo(() => new Map(allProjectsList.map(p => [p.id, p.name])), [allProjectsList]);
  const employeeMap = useMemo(() => new Map(allEmployeesList.map(e => [e.id, e.name])), [allEmployeesList]);

  const loadLookupData = useCallback(async () => {
    setIsLoadingLookups(true);
    try {
      const [projectsResult, employeesResult]: [FetchAllProjectsResult, FetchUsersByRoleResult] = await Promise.all([
        fetchAllProjects(),
        fetchUsersByRole('employee')
      ]);
      if (projectsResult.success && projectsResult.projects) setAllProjectsList(projectsResult.projects);
      else {
        setAllProjectsList([]);
        console.error("Failed to fetch projects:", projectsResult.error);
      }
      if (employeesResult.success && employeesResult.users) setAllEmployeesList(employeesResult.users);
      else {
        setAllEmployeesList([]);
        console.error("Failed to fetch employees:", employeesResult.error);
      }
    } catch (error) {
      toast({ title: "Error loading lookup data", description: "Could not fetch projects or employees.", variant: "destructive" });
      setAllProjectsList([]);
      setAllEmployeesList([]);
    } finally {
      setIsLoadingLookups(false);
    }
  }, [toast]);

  const fetchHistoryRecords = useCallback(async (loadMore = false) => {
    if (!user?.id || authLoading) return;
    
    if (!loadMore) {
      setHistoryRecordsLoading(true);
      setAllLoadedHistoryRecords([]);
      setLastHistoryCursor(undefined);
      setHasMoreHistory(true);
    } else {
      if (!hasMoreHistory || lastHistoryCursor === null) return;
      setIsFetchingMoreHistory(true);
    }

    let result: FetchPayrollRecordsResult;
    if (historyEmployeeIdFilter.trim()) {
      result = await getPayrollRecordsForEmployee(
        historyEmployeeIdFilter.trim(), 
        PAYROLL_RECORDS_PER_PAGE, 
        loadMore ? lastHistoryCursor : undefined
      );
    } else {
      result = await getAllPayrollRecords(
        user.id, 
        PAYROLL_RECORDS_PER_PAGE, 
        loadMore ? lastHistoryCursor : undefined
      );
    }

    if (result.success && result.records) {
      setAllLoadedHistoryRecords(prev => loadMore ? [...prev, ...result.records!] : result.records!);
      setLastHistoryCursor(result.lastVisiblePayPeriodStartISO);
      setHasMoreHistory(result.hasMore || false);
      if (!loadMore && !historyEmployeeIdFilter.trim()) {
        toast({ title: "Payroll History Loaded", description: `Showing first ${result.records.length} records.` });
      }
    } else {
      if (!loadMore) setAllLoadedHistoryRecords([]);
      setHasMoreHistory(false);
      toast({ title: "Failed to Load History", description: result.error || "Could not fetch payroll records.", variant: "destructive" });
    }
    
    if (!loadMore) setHistoryRecordsLoading(false);
    else setIsFetchingMoreHistory(false);
  }, [user?.id, authLoading, toast, historyEmployeeIdFilter, lastHistoryCursor, hasMoreHistory]);

  useEffect(() => {
    if (user && !authLoading) {
      loadLookupData();
      fetchHistoryRecords(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Refetch when filter changes
  useEffect(() => {
    if (user && !authLoading && !isLoadingLookups) { 
        fetchHistoryRecords(false); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEmployeeIdFilter]); 


  const handleRunPayroll = async () => {
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }
    if (!runPayrollProjectId || !runPayrollStartDate || !runPayrollEndDate) {
      toast({ title: "Input Error", description: "Project, Start Date, and End Date are required.", variant: "destructive" });
      return;
    }
    if (runPayrollEndDate < runPayrollStartDate) {
      toast({ title: "Input Error", description: "End Date cannot be before Start Date.", variant: "destructive" });
      return;
    }

    setRunPayrollLoading(true);
    setRunPayrollResult(null);
    const result = await calculatePayrollForProject(
      user.id,
      runPayrollProjectId,
      format(runPayrollStartDate, "yyyy-MM-dd"),
      format(runPayrollEndDate, "yyyy-MM-dd")
    );

    if (result.success && result.summary) {
      setRunPayrollResult(result.summary);
      toast({ title: "Payroll Calculated", description: result.message || "Payroll processed successfully." });
      if (result.payrollRecordIds && result.payrollRecordIds.length > 0) {
        fetchHistoryRecords(false); 
      }
    } else {
      toast({ title: "Payroll Calculation Failed", description: result.error || "An unknown error occurred.", variant: "destructive" });
    }
    setRunPayrollLoading(false);
  };


  const handleFetchProjectSummary = async () => {
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }
    if (!summaryProjectIdInput.trim()) {
      toast({ title: "Input Error", description: "Project ID is required.", variant: "destructive" });
      return;
    }
    setSummaryLoading(true);
    setProjectPayrollSummary(null);
    const result = await getPayrollSummaryForProject(summaryProjectIdInput.trim(), user.id);

    if (result.success && result.summary) {
      setProjectPayrollSummary(result.summary);
      toast({ title: "Project Summary Loaded", description: result.message || "Summary fetched successfully." });
    } else {
      toast({ title: "Failed to Load Summary", description: result.error || "An unknown error occurred.", variant: "destructive" });
    }
    setSummaryLoading(false);
  };

  const downloadCSV = (csvData: string, filename: string) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleExportCSV = async () => {
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }
    setExportingCsv(true);
    const result = await exportPayrollHistoryToCSV(user.id, historyEmployeeIdFilter.trim() || undefined);
    if (result.success && result.csvData) {
      if (result.csvData.length > 0) {
        downloadCSV(result.csvData, `payroll-history-${historyEmployeeIdFilter.trim() || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
        toast({ title: "CSV Exported", description: "Payroll history has been downloaded." });
      } else {
        toast({ title: "No Data to Export", description: result.message || "No records found for the current filter." });
      }
    } else {
      toast({ title: "CSV Export Failed", description: result.error || "Could not export payroll history.", variant: "destructive" });
    }
    setExportingCsv(false);
  };
  
  if (authLoading || isLoadingLookups) {
    return <div className="p-4 flex items-center justify-center min-h-screen"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user || user.role !== 'admin') {
    return <div className="p-4"><PageHeader title="Access Denied" description="You must be an admin to view this page." /></div>;
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Admin Payroll Dashboard" description="Manage and review payroll operations." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center"><PlayCircle className="mr-2 h-6 w-6 text-primary"/>Run Payroll for Project</CardTitle>
          <CardDescription>Calculate and generate payroll records for employees on a specific project within a date range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="runPayrollProjectId">Project</Label>
               <Select value={runPayrollProjectId} onValueChange={setRunPayrollProjectId} disabled={isLoadingLookups || allProjectsList.length === 0}>
                <SelectTrigger id="runPayrollProjectId">
                    <SelectValue placeholder={isLoadingLookups ? "Loading projects..." : (allProjectsList.length === 0 ? "No projects available" : "Select a project")} />
                </SelectTrigger>
                <SelectContent>
                    {isLoadingLookups ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                     allProjectsList.length > 0 ? allProjectsList.map(proj => (
                        <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                    )) : <SelectItem value="no-projects" disabled>No projects found. Please create one first.</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="runPayrollStartDate">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="runPayrollStartDate" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {runPayrollStartDate ? format(runPayrollStartDate, "PPP") : <span>Pick a start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={runPayrollStartDate} onSelect={setRunPayrollStartDate} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="runPayrollEndDate">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="runPayrollEndDate" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {runPayrollEndDate ? format(runPayrollEndDate, "PPP") : <span>Pick an end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={runPayrollEndDate} onSelect={setRunPayrollEndDate} initialFocus /></PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleRunPayroll} disabled={runPayrollLoading || isLoadingLookups} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {runPayrollLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
            {runPayrollLoading ? "Calculating..." : "Run Payroll"}
          </Button>
        </CardFooter>
      </Card>

      {runPayrollResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-headline">Payroll Calculation Summary</CardTitle>
            <CardDescription>{runPayrollResult.length === 0 ? "No payroll data generated for this selection." : `Generated payroll details for ${runPayrollResult.filter(r => !r.message?.includes('Skipped')).length} employee(s).`}</CardDescription>
          </CardHeader>
          <CardContent>
            {runPayrollResult.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {runPayrollResult.map((summary, index) => (
                  <Card key={summary.payrollRecordId || index} className={summary.message?.includes('Skipped') || summary.message?.includes('Error') ? "bg-muted/50 border-dashed" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md">{summary.employeeName}</CardTitle>
                       {summary.message && <div className={`text-xs pt-1 ${summary.message.includes('Error') ? 'text-destructive' : 'text-muted-foreground'}`}>{summary.message}</div>}
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <div>Hours Worked: <Badge variant="secondary">{summary.hoursWorked.toFixed(2)}</Badge></div>
                      <div>Rate Used: <Badge variant="outline">{formatCurrency(summary.hourlyRate)}</Badge></div>
                      <div>Task Pay: <span className="font-semibold">{formatCurrency(summary.taskPay)}</span></div>
                      <div>Expenses: <span className="font-semibold">{formatCurrency(summary.approvedExpenses)}</span></div>
                      <div className="font-bold text-primary">Total Pay: {formatCurrency(summary.totalPay)}</div>
                      {!summary.message?.includes('Skipped') && !summary.message?.includes('Error') && <div className="text-xs text-muted-foreground pt-1">Record ID: {summary.payrollRecordId.substring(0,10)}...</div>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No summary to display.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center"><ListOrdered className="mr-2 h-6 w-6 text-primary"/>Payroll History</CardTitle>
          <CardDescription>View generated payroll records. Filter by employee, or leave blank for all recent records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex gap-2 items-end flex-grow">
              <div className="flex-grow space-y-1 min-w-[200px]">
                <Label htmlFor="historyEmployeeIdFilter">Filter by Employee</Label>
                <Select
                    value={historyEmployeeIdFilter || 'all'}
                    onValueChange={(value) => setHistoryEmployeeIdFilter(value === 'all' ? '' : value)}
                    disabled={isLoadingLookups || allEmployeesList.length === 0}
                >
                    <SelectTrigger id="historyEmployeeIdFilter">
                        <SelectValue placeholder={isLoadingLookups ? "Loading employees..." : "All Employees"}/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {allEmployeesList.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleExportCSV} disabled={exportingCsv || historyRecordsLoading || allLoadedHistoryRecords.length === 0} variant="outline">
              {exportingCsv ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
              {exportingCsv ? "Exporting..." : "Download CSV"}
            </Button>
          </div>
          {(historyRecordsLoading && !isFetchingMoreHistory) ? (
            <div className="text-center py-4"><RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : allLoadedHistoryRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payroll records found matching criteria.</p>
          ) : (
            <>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead className="text-right">Task Pay</TableHead>
                  <TableHead className="text-right">Expense Pay</TableHead>
                  <TableHead className="text-right">Total Pay</TableHead>
                  <TableHead>Generated At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLoadedHistoryRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{employeeMap.get(record.employeeId) || record.employeeId.substring(0,8)+"..."}</TableCell>
                    <TableCell>{projectMap.get(record.projectId) || record.projectId.substring(0,8)+"..."}</TableCell>
                    <TableCell>{formatDateSafe(record.payPeriod.start)} - {formatDateSafe(record.payPeriod.end)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.taskPay)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.approvedExpenses)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(record.totalPay)}</TableCell>
                    <TableCell>{formatDateSafe(record.generatedAt, "PPpp")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            {hasMoreHistory && (
              <div className="mt-4 text-center">
                <Button onClick={() => fetchHistoryRecords(true)} disabled={isFetchingMoreHistory || historyRecordsLoading}>
                  {isFetchingMoreHistory ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                  Load More History
                </Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center"><BarChartBig className="mr-2 h-6 w-6 text-primary"/>Project Payroll Summary</CardTitle>
          <CardDescription>View aggregated payroll costs for a specific project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-grow space-y-1">
              <Label htmlFor="summaryProjectIdInput">Project</Label>
               <Select value={summaryProjectIdInput} onValueChange={setSummaryProjectIdInput} disabled={isLoadingLookups || allProjectsList.length === 0}>
                <SelectTrigger id="summaryProjectIdInput">
                    <SelectValue placeholder={isLoadingLookups ? "Loading projects..." : (allProjectsList.length === 0 ? "No projects available" : "Select a project")} />
                </SelectTrigger>
                <SelectContent>
                     {isLoadingLookups ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                     allProjectsList.length > 0 ? allProjectsList.map(proj => (
                        <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                    )) : <SelectItem value="no-projects" disabled>No projects found</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleFetchProjectSummary} disabled={summaryLoading || isLoadingLookups} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {summaryLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4"/>}
              View Summary
            </Button>
          </div>
          {summaryLoading && <div className="text-center py-4"><RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" /></div>}
          {projectPayrollSummary && !summaryLoading && (
            <Card className="mt-4 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Summary for Project: {projectMap.get(projectPayrollSummary.projectId) || projectPayrollSummary.projectId}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="text-xl font-bold text-primary">Total Project Payroll Cost: {formatCurrency(projectPayrollSummary.totalProjectPayrollCost)}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>Total Hours Worked: <Badge variant="secondary">{projectPayrollSummary.totalHoursWorkedOverall.toFixed(2)} hrs</Badge></div>
                    <div>Total Task Compensation: <Badge variant="outline">{formatCurrency(projectPayrollSummary.totalTaskCompensation)}</Badge></div>
                    <div>Total Expenses Reimbursed: <Badge variant="outline">{formatCurrency(projectPayrollSummary.totalExpensesReimbursed)}</Badge></div>
                </div>
                {projectPayrollSummary.employeeBreakdown.length > 0 && (
                  <div>
                    <h4 className="font-semibold mt-3 mb-1">Employee Breakdown:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {projectPayrollSummary.employeeBreakdown.map(emp => (
                        <li key={emp.employeeId}>
                          {emp.employeeName}: <span className="font-semibold">{formatCurrency(emp.grandTotalPay)}</span> ({emp.recordCount} record(s))
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                 {projectPayrollSummary.employeeBreakdown.length === 0 && <div className="text-xs text-muted-foreground">No employee payroll data found for this project in existing records.</div>}
              </CardContent>
            </Card>
          )}
           {!projectPayrollSummary && !summaryLoading && <div className="text-muted-foreground text-sm pt-2">Select a Project and click "View Summary" to see details.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
