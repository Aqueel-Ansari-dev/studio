
"use client";

import { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { addEmployeeRate, AddEmployeeRateInput, getEmployeeRate } from '@/app/actions/payroll/manageEmployeeRates';
import { calculatePayrollForProject } from '@/app/actions/payroll/payrollProcessing';
import { getPayrollRecordsForEmployee, getPayrollSummaryForProject } from '@/app/actions/payroll/fetchPayrollData';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { EmployeeRate, PayrollRecord } from '@/types/database';

export default function PayrollTestPanelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);

  // Add Rate States
  const [rateEmployeeId, setRateEmployeeId] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState<Date | undefined>(undefined);

  // Get Rate State
  const [getRateEmployeeId, setGetRateEmployeeId] = useState('');

  // Calculate Payroll States
  const [calcProjectId, setCalcProjectId] = useState('');
  const [calcStartDate, setCalcStartDate] = useState<Date | undefined>(undefined);
  const [calcEndDate, setCalcEndDate] = useState<Date | undefined>(undefined);

  // Get Employee Records States
  const [recordsEmployeeId, setRecordsEmployeeId] = useState('');

  // Get Project Summary States
  const [summaryProjectId, setSummaryProjectId] = useState('');

  const handleAction = async (actionFn: () => Promise<any>) => {
    if (!user || user.role !== 'admin') {
      toast({ title: "Unauthorized", description: "Only admins can perform test actions.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setActionResult(null);
    try {
      const result = await actionFn();
      setActionResult(result);
      toast({ title: "Action Executed", description: "Check result below. Result also logged to console." });
      console.log("Action Result:", result);
    } catch (error: any) {
      setActionResult({ error: true, message: error.message, stack: error.stack });
      toast({ title: "Action Failed", description: error.message, variant: "destructive" });
      console.error("Action Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRate = () => {
    if (!rateEmployeeId || !hourlyRate || !effectiveFrom) {
        toast({ title: "Input Error", description: "All fields for Add Rate are required.", variant: "destructive" });
        return;
    }
    const input: AddEmployeeRateInput = {
      employeeId: rateEmployeeId,
      hourlyRate: parseFloat(hourlyRate),
      effectiveFrom: effectiveFrom,
    };
    handleAction(() => addEmployeeRate(user!.id, input));
  };

  const handleGetRate = () => {
    if (!getRateEmployeeId) {
        toast({ title: "Input Error", description: "Employee ID for Get Rate is required.", variant: "destructive" });
        return;
    }
    handleAction(() => getEmployeeRate(getRateEmployeeId));
  };

  const handleCalculatePayroll = () => {
     if (!calcProjectId || !calcStartDate || !calcEndDate) {
        toast({ title: "Input Error", description: "Project ID, Start Date, and End Date are required.", variant: "destructive" });
        return;
    }
    handleAction(() => calculatePayrollForProject(
      user!.id, 
      calcProjectId, 
      format(calcStartDate, "yyyy-MM-dd"), 
      format(calcEndDate, "yyyy-MM-dd")
    ));
  };

  const handleGetEmployeeRecords = () => {
    if(!recordsEmployeeId) {
        toast({ title: "Input Error", description: "Employee ID is required.", variant: "destructive" });
        return;
    }
    handleAction(() => getPayrollRecordsForEmployee(recordsEmployeeId));
  };

  const handleGetProjectSummary = () => {
     if(!summaryProjectId) {
        toast({ title: "Input Error", description: "Project ID is required.", variant: "destructive" });
        return;
    }
    handleAction(() => getPayrollSummaryForProject(summaryProjectId, user!.id));
  };


  return (
    <div className="space-y-6">
      <PageHeader title="Payroll Test Panel (Admin)" description="Manually trigger payroll server actions for testing." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add/Get Employee Rate Card */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Employee Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 p-4 border rounded-md">
              <Label className="font-semibold">Add New Rate</Label>
              <Input placeholder="Employee ID" value={rateEmployeeId} onChange={e => setRateEmployeeId(e.target.value)} />
              <Input type="number" placeholder="Hourly Rate (e.g., 15.50)" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {effectiveFrom ? format(effectiveFrom, "PPP") : <span>Effective From Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={effectiveFrom} onSelect={setEffectiveFrom} initialFocus /></PopoverContent>
              </Popover>
              <Button onClick={handleAddRate} disabled={isLoading} className="w-full">Add Rate</Button>
            </div>
            <div className="space-y-2 p-4 border rounded-md">
              <Label className="font-semibold">Get Employee's Current Rate</Label>
              <Input placeholder="Employee ID" value={getRateEmployeeId} onChange={e => setGetRateEmployeeId(e.target.value)} />
              <Button onClick={handleGetRate} disabled={isLoading} className="w-full">Get Rate</Button>
            </div>
          </CardContent>
        </Card>

        {/* Calculate Payroll Card */}
        <Card>
          <CardHeader>
            <CardTitle>Calculate Payroll for Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Project ID" value={calcProjectId} onChange={e => setCalcProjectId(e.target.value)} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {calcStartDate ? format(calcStartDate, "PPP") : <span>Pay Period Start Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={calcStartDate} onSelect={setCalcStartDate} initialFocus /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {calcEndDate ? format(calcEndDate, "PPP") : <span>Pay Period End Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={calcEndDate} onSelect={setCalcEndDate} initialFocus /></PopoverContent>
            </Popover>
            <Button onClick={handleCalculatePayroll} disabled={isLoading} className="w-full">Calculate Payroll</Button>
          </CardContent>
        </Card>

        {/* Fetch Payroll Records Card */}
        <Card>
          <CardHeader>
            <CardTitle>Fetch Employee Payroll Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Employee ID" value={recordsEmployeeId} onChange={e => setRecordsEmployeeId(e.target.value)} />
            <Button onClick={handleGetEmployeeRecords} disabled={isLoading} className="w-full">Get Employee Records</Button>
          </CardContent>
        </Card>

        {/* Fetch Project Payroll Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Fetch Project Payroll Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Project ID" value={summaryProjectId} onChange={e => setSummaryProjectId(e.target.value)} />
            <Button onClick={handleGetProjectSummary} disabled={isLoading} className="w-full">Get Project Summary</Button>
          </CardContent>
        </Card>
      </div>

      {actionResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Action Result</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              value={JSON.stringify(actionResult, (key, value) => {
                // Custom serializer for Firestore Timestamps
                if (value && typeof value === 'object' && value.hasOwnProperty('seconds') && value.hasOwnProperty('nanoseconds')) {
                  try {
                    return new Date(value.seconds * 1000 + value.nanoseconds / 1000000).toISOString();
                  } catch (e) {
                    return "Invalid Timestamp";
                  }
                }
                return value;
              }, 2)}
              rows={15}
              className="font-mono text-xs"
            />
          </CardContent>
        </Card>
      )}
      <Card className="mt-6 bg-amber-50 border-amber-200">
        <CardHeader>
            <CardTitle className="text-amber-700">Important Notes for Testing</CardTitle>
        </CardHeader>
        <CardContent className="text-amber-600 text-sm space-y-2">
            <p><strong>1. Data Setup:</strong> Ensure you have relevant data in Firestore:</p>
            <ul className="list-disc list-inside pl-4">
                <li>Users with 'employee' role and valid UIDs (for Employee ID fields).</li>
                <li>Projects with valid Project IDs.</li>
                <li>Tasks assigned to these employees and projects. Tasks must have `status` as 'completed' or 'verified', and a valid `elapsedTime` (in seconds). The `updatedAt` (or `endTime` if you've ensured it's set) of these tasks should fall within your test pay periods.</li>
                <li>Employee expenses that are `approved: true` and have an `approvedAt` timestamp falling within your test pay periods, linked to the respective employees and projects.</li>
                <li>If testing `getEmployeeRate`, ensure rates are added via the 'Add New Rate' panel first, with `effectiveFrom` dates relevant to your test scenarios.</li>
            </ul>
            <p><strong>2. Firestore Indexes:</strong> New queries might require composite indexes. Check your Firebase console logs (and Next.js server logs) for direct links to create them if you encounter Firestore errors related to indexing (often error code `failed-precondition`).</p>
            <p><strong>3. Date Handling:</strong> Dates selected in the UI are local. Server actions convert them to UTC Timestamps or specific string formats (yyyy-MM-dd) as needed for queries.</p>
            <p><strong>4. Server Logs:</strong> Check your Next.js server-side console for detailed logs from the actions, especially if `console.log` statements are present in the actions.</p>
            <p><strong>5. For Development Only:</strong> This panel is for testing and should be removed or secured before deploying to production.</p>
        </CardContent>
      </Card>
    </div>
  );
}

    