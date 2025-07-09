
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, CalendarIcon, Send, Plane, Coffee, HeartPulse, Briefcase, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { requestLeave, getLeaveRequests, getLeaveBalance, RequestLeaveInput, LeaveRequest, LeaveBalance } from '@/app/actions/leave/leaveActions';
import { fetchAllProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { format, differenceInCalendarDays, parseISO, isFuture } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const leaveTypes = [
    { value: 'sick', label: 'Sick Leave', icon: HeartPulse },
    { value: 'casual', label: 'Casual Leave', icon: Coffee },
    { value: 'unpaid', label: 'Unpaid Leave', icon: Plane }
] as const;

type LeaveType = typeof leaveTypes[number]['value'];

const LeaveBalanceChip = ({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) => (
    <div className={cn("flex flex-col items-center justify-center p-3 rounded-lg bg-muted", colorClass)}>
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
    </div>
);

export default function LeaveRequestPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();

    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [allProjects, setAllProjects] = useState<ProjectForSelection[]>([]);
    const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [projectId, setProjectId] = useState<string | undefined>(undefined);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [leaveType, setLeaveType] = useState<LeaveType>('sick');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadInitialData = useCallback(async () => {
        if (!user?.id || !user.organizationId) return;
        setIsLoading(true);
        try {
            const [projectsResult, requestsResult, balanceResult] = await Promise.all([
                fetchAllProjects(user.organizationId),
                getLeaveRequests(user.id),
                getLeaveBalance(user.id)
            ]);

            if (projectsResult.success && projectsResult.projects) setAllProjects(projectsResult.projects);
            else console.error("Failed to load projects:", projectsResult.error);

            if (!('error' in requestsResult)) setRequests(requestsResult);
            else console.error("Failed to load leave requests:", requestsResult.error);

            if (balanceResult.success && balanceResult.balance) setLeaveBalance(balanceResult.balance);
            else console.error("Failed to load leave balance:", balanceResult.error);

        } catch (error) {
            toast({ title: 'Error Loading Data', description: 'Could not fetch necessary data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (user && !authLoading) {
            loadInitialData();
        }
    }, [user, authLoading, loadInitialData]);

    const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (e.target.value.length <= 140) {
            setReason(e.target.value);
        }
    };

    const resetForm = () => {
        setProjectId(undefined);
        setDateRange(undefined);
        setLeaveType('sick');
        setReason('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !dateRange?.from || !reason.trim()) {
            toast({ title: 'Missing Data', description: 'Please select leave dates and provide a reason.', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        const input: RequestLeaveInput = {
            projectId: projectId || undefined,
            fromDate: dateRange.from,
            toDate: dateRange.to || dateRange.from,
            leaveType,
            reason
        };
        const result = await requestLeave(user.id, input);
        if (result.success) {
            toast({ title: 'Leave Requested', description: result.message, variant: 'default' });
            resetForm();
            loadInitialData();
        } else {
            toast({ title: 'Request Failed', description: result.message, variant: 'destructive' });
        }
        setSubmitting(false);
    };

    const { upcomingRequests, pastRequests } = useMemo(() => {
        const upcoming: LeaveRequest[] = [];
        const past: LeaveRequest[] = [];
        requests.forEach(req => {
            if (req.status === 'pending' || (req.status === 'approved' && isFuture(parseISO(req.toDate)))) {
                upcoming.push(req);
            } else {
                past.push(req);
            }
        });
        return { upcomingRequests: upcoming, pastRequests: past };
    }, [requests]);
    
    const selectedDays = dateRange?.from && dateRange.to ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1 : (dateRange?.from ? 1 : 0);
    
    const getStatusBadge = (status: LeaveRequest['status']) => {
        switch (status) {
            case 'approved': return <Badge className="bg-success text-success-foreground">Approved</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            case 'pending': default: return <Badge variant="outline">Pending</Badge>;
        }
    };

    if (authLoading || isLoading) {
        return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Leave Requests" description="Submit and view your leave requests." />

            <Card>
                <CardHeader><CardTitle className="font-headline">My Leave Balance</CardTitle></CardHeader>
                <CardContent>
                    {leaveBalance ? (
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <LeaveBalanceChip label="Total Paid / Year" value={leaveBalance.totalPaidLeaves} />
                            <LeaveBalanceChip label="Approved" value={leaveBalance.approvedPaidLeavesTaken} />
                            <LeaveBalanceChip label="Pending" value={leaveBalance.pendingPaidLeaves} />
                            <LeaveBalanceChip label="Remaining" value={leaveBalance.remainingPaidLeaves} colorClass="bg-success/10 text-success-foreground" />
                        </div>
                    ) : <Skeleton className="h-20 w-full" />}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-lg">
                    <CardHeader><CardTitle className="font-headline">New Leave Request</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <Label htmlFor="project">Project (Optional)</Label>
                                <Select value={projectId} onValueChange={(value) => setProjectId(value === "none" ? undefined : value)} disabled={allProjects.length === 0}>
                                    <SelectTrigger id="project"><SelectValue placeholder="Select project (optional)" /></SelectTrigger>
                                    <SelectContent><SelectItem value="none">No specific project</SelectItem>{allProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Leave Type</Label>
                                <RadioGroup value={leaveType} onValueChange={(v: LeaveType) => setLeaveType(v)} className="grid grid-cols-3 gap-2 mt-2">
                                    {leaveTypes.map(item => (
                                        <div key={item.value}>
                                            <RadioGroupItem value={item.value} id={item.value} className="sr-only" />
                                            <Label htmlFor={item.value} className={cn("flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer", leaveType === item.value && "border-primary")}>
                                                <item.icon className="mb-3 h-6 w-6" />{item.label}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>

                            <div>
                                <Label>Dates</Label>
                                <Popover><PopoverTrigger asChild><Button id="date" variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={1} /></PopoverContent></Popover>
                                {selectedDays > 0 && <p className="text-right text-sm text-muted-foreground mt-1">{selectedDays} day(s) selected</p>}
                            </div>

                            <div>
                                <Label htmlFor="reason">Reason</Label>
                                <Textarea id="reason" value={reason} onChange={handleReasonChange} placeholder="Brief reason for leave" />
                                <p className="text-right text-sm text-muted-foreground mt-1">{reason.length} / 140</p>
                            </div>

                            <Button type="submit" disabled={submitting} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                                {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Submit Request
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="font-headline">Request History</CardTitle></CardHeader>
                    <CardContent>
                        <Tabs defaultValue="upcoming">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                                <TabsTrigger value="past">History</TabsTrigger>
                            </TabsList>
                            <TabsContent value="upcoming">
                                {upcomingRequests.length > 0 ? (
                                    <Accordion type="single" collapsible className="w-full">
                                        {upcomingRequests.map(req => (
                                            <AccordionItem value={req.id} key={req.id}>
                                                <AccordionTrigger>
                                                    <div className="flex justify-between w-full items-center pr-4">
                                                        <div className="text-left"><Badge variant="outline">{format(parseISO(req.fromDate), 'MMM d')} - {format(parseISO(req.toDate), 'MMM d, yyyy')}</Badge><div className="text-xs text-muted-foreground mt-1">{req.leaveType}</div></div>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="text-sm text-muted-foreground">{req.reason}</AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : <p className="text-center text-muted-foreground pt-8">No upcoming leave requests.</p>}
                            </TabsContent>
                             <TabsContent value="past">
                                {pastRequests.length > 0 ? (
                                    <Accordion type="single" collapsible className="w-full">
                                        {pastRequests.map(req => (
                                            <AccordionItem value={req.id} key={req.id}>
                                                <AccordionTrigger>
                                                     <div className="flex justify-between w-full items-center pr-4">
                                                        <div className="text-left"><Badge variant="outline">{format(parseISO(req.fromDate), 'MMM d')} - {format(parseISO(req.toDate), 'MMM d, yyyy')}</Badge><div className="text-xs text-muted-foreground mt-1">{req.leaveType}</div></div>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="text-sm text-muted-foreground">{req.reason}</AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : <p className="text-center text-muted-foreground pt-8">No past leave requests found.</p>}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
