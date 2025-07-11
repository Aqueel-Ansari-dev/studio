
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Briefcase, Calendar, Check, ChevronLeft, ChevronRight, Clock, Coffee, Eye, HeartPulse, MapPin, Plane, RefreshCw, Note } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchAttendanceLogsForEmployeeByMonth, AttendanceLogForCalendar } from '@/app/actions/attendance';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { format, parseISO, isValid, differenceInSeconds, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatCardProps {
    label: string;
    count: number;
    colorClass: string;
    icon: React.ElementType;
}

const StatCard = ({ label, count, colorClass, icon: Icon }: StatCardProps) => (
  <div className={`p-3 rounded-lg flex items-center gap-3 ${colorClass}`}>
    <Icon className="w-6 h-6" />
    <div className="flex-grow">
      <div className="text-xs">{label}</div>
      <div className="text-xl font-bold">{count}</div>
    </div>
  </div>
);

export default function EmployeeAttendanceCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [attendanceLogsForMonth, setAttendanceLogsForMonth] = useState<AttendanceLogForCalendar[]>([]);
  const [projectsMap, setProjectsMap] = useState<Map<string, string>>(new Map());
  
  const [selectedDayData, setSelectedDayData] = useState<{ date: Date; logs: AttendanceLogForCalendar[]; } | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await fetchAllProjects(user.id);
      if (result.success && result.projects) {
        const map = new Map<string, string>();
        result.projects.forEach(p => map.set(p.id, p.name));
        setProjectsMap(map);
      } else {
        toast({ title: "Error loading projects", description: result.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error loading projects", variant: "destructive" });
    }
  }, [toast, user?.id]);

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const result = await fetchAttendanceLogsForEmployeeByMonth(user.id, year, month);
      if (result.success && result.logs) {
        setAttendanceLogsForMonth(result.logs);
      } else {
        toast({ title: "Error loading attendance", description: result.error, variant: "destructive" });
        setAttendanceLogsForMonth([]);
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not load attendance data.", variant: "destructive" });
      setAttendanceLogsForMonth([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentMonth, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      loadProjects();
      loadAttendanceData();
    }
  }, [authLoading, user, loadProjects, loadAttendanceData]);
  
  const handleDayClick = (day: Date) => {
    if (isPast(day) || isToday(day)) {
        const logsForDay = attendanceLogsForMonth.filter(log => isSameDay(parseISO(log.date), day));
        setSelectedDayData({ date: day, logs: logsForDay });
        setIsSheetOpen(true);
    } else {
        toast({title: "Future Date", description: "Cannot view attendance for a future date."})
    }
  };

  const attendanceSets = useMemo(() => {
    const presentDays = new Set<string>();
    attendanceLogsForMonth.forEach(log => {
      if (log.date && isValid(parseISO(log.date))) {
        const dayStr = format(parseISO(log.date), 'yyyy-MM-dd');
        presentDays.add(dayStr);
      }
    });
    return { presentDays };
  }, [attendanceLogsForMonth]);

  const attendanceStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    let present = 0;
    let absent = 0;
    let weekOff = 0;

    daysInMonth.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);

        if (attendanceSets.presentDays.has(dayStr)) {
            present++;
        } else if (dayOfWeek === 0 || dayOfWeek === 6) { // Saturday & Sunday
            weekOff++;
        } else if (isPast(day) && !isToday(day)) {
            absent++;
        }
    });

    return { present, absent, weekOff };
  }, [currentMonth, attendanceSets]);

  const daysToRender = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDay = getDay(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const leadingEmptyDays = Array.from({ length: startDay }, (_, i) => new Date(0));
    return [...leadingEmptyDays, ...days];
  }, [currentMonth]);
  
  const getDayStatus = useCallback((day: Date) => {
    if (isToday(day)) return 'today';
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayOfWeek = getDay(day);

    if (attendanceSets.presentDays.has(dayStr)) return 'present';
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'weekend';
    if (isPast(day)) return 'absent';
    return 'future';
  }, [attendanceSets]);

  const formatDuration = (start: string | null, end: string | null): string => {
    if (!start || !end) return "N/A";
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    if (!isValid(startDate) || !isValid(endDate)) return "N/A";
    
    const diffSeconds = differenceInSeconds(endDate, startDate);
    if (diffSeconds < 0) return "Invalid";

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };
  
  const totalTimeForDay = useMemo(() => {
    if (!selectedDayData?.logs.length) return "0h 0m";
    let totalSeconds = 0;
    selectedDayData.logs.forEach(log => {
      if (log.checkInTime && log.checkOutTime) {
        const startDate = parseISO(log.checkInTime);
        const endDate = parseISO(log.checkOutTime);
        if (isValid(startDate) && isValid(endDate)) {
          totalSeconds += differenceInSeconds(endDate, startDate);
        }
      }
    });
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, [selectedDayData]);

  if (authLoading || (!user && isLoading)) {
    return <div className="p-4"><RefreshCw className="h-8 w-8 animate-spin" /> Loading...</div>;
  }
  
  if (!user) {
    return <div className="p-4">Please log in to view your attendance.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Attendance Calendar" 
        description="View your attendance log. Click on a date to see details."
        actions={
          <Button onClick={loadAttendanceData} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />
      <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="font-headline">Monthly Summary</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="w-32 text-center font-semibold">{format(currentMonth, 'MMMM yyyy')}</span>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                <StatCard label="Present" count={attendanceStats.present} colorClass="bg-green-100 text-green-800" icon={Calendar} />
                <StatCard label="Absent" count={attendanceStats.absent} colorClass="bg-red-100 text-red-800" icon={Calendar} />
                <StatCard label="Week Off" count={attendanceStats.weekOff} colorClass="bg-gray-100 text-gray-800" icon={Coffee} />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground border-b pb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
            </div>
            {isLoading ? (
                <div className="h-96 flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin" /></div>
            ) : (
            <div className="grid grid-cols-7 gap-1.5 mt-2">
            {daysToRender.map((day, index) => {
                if (day.getFullYear() === 1970) return <div key={`empty-${index}`} />;
                const status = getDayStatus(day);
                return (
                <button
                    key={index}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                    "h-14 sm:h-16 rounded-md flex flex-col items-center justify-center p-1 text-sm border focus:outline-none focus:ring-2 focus:ring-primary focus:z-10 transition-colors",
                    status === 'present' && "bg-green-100 text-green-900 font-bold border-green-200",
                    status === 'absent' && "bg-red-100 text-red-900 border-red-200",
                    status === 'weekend' && "bg-gray-100 text-gray-500 border-gray-200",
                    status === 'future' && "bg-white text-gray-400 cursor-not-allowed",
                    status === 'today' && "ring-2 ring-primary bg-primary/10",
                    )}
                    disabled={status === 'future'}
                >
                    <span>{format(day, 'd')}</span>
                </button>
                );
            })}
            </div>
            )}
        </CardContent>
      </Card>

      {selectedDayData && (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="font-headline">
              Attendance for {format(selectedDayData.date, "PPP")}
            </SheetTitle>
            <SheetDescription>
              Total time worked: <span className="font-semibold text-primary">{totalTimeForDay}</span>
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-grow p-6">
            <div className="space-y-4">
              {selectedDayData.logs.length === 0 ? (
                <p className="text-muted-foreground text-center">No attendance records for this day.</p>
              ) : (
                selectedDayData.logs.map((log, index) => (
                  <Card key={log.id || index} className="overflow-hidden">
                    <CardHeader className="flex flex-row justify-between items-start bg-muted/50 p-3">
                      <div>
                        <CardTitle className="text-base flex items-center">
                           <Briefcase className="w-4 h-4 mr-2 text-primary"/>
                           {projectsMap.get(log.projectId) || log.projectId}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Session {index + 1} - Duration: {formatDuration(log.checkInTime, log.checkOutTime)}
                        </CardDescription>
                      </div>
                       {log.autoLoggedFromTask && <Badge variant="outline" className="text-xs">Auto-logged</Badge>}
                    </CardHeader>
                    <CardContent className="p-3 text-sm space-y-2">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-green-600" />
                        Check-in: {log.checkInTime ? format(parseISO(log.checkInTime), 'p') : 'N/A'}
                        {log.selfieCheckInUrl && <Eye className="ml-auto h-4 w-4 text-muted-foreground"/>}
                      </div>
                      {log.gpsLocationCheckIn && (
                        <p className="text-xs text-muted-foreground pl-6 flex items-center">
                          <MapPin className="w-3 h-3 mr-1"/> 
                          Lat: {log.gpsLocationCheckIn.lat.toFixed(3)}, Lng: {log.gpsLocationCheckIn.lng.toFixed(3)}
                        </p>
                      )}

                      {log.checkOutTime ? (
                        <>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-red-600" />
                            Check-out: {format(parseISO(log.checkOutTime), 'p')}
                             {log.selfieCheckOutUrl && <Eye className="ml-auto h-4 w-4 text-muted-foreground"/>}
                          </div>
                          {log.gpsLocationCheckOut && (
                            <p className="text-xs text-muted-foreground pl-6 flex items-center">
                                <MapPin className="w-3 h-3 mr-1"/>
                                Lat: {log.gpsLocationCheckOut.lat.toFixed(3)}, Lng: {log.gpsLocationCheckOut.lng.toFixed(3)}
                            </p>
                          )}
                           {log.sessionNotes && <div className="pl-6 pt-1"><p className="text-xs font-semibold">Notes:</p><p className="text-xs italic text-muted-foreground">{log.sessionNotes}</p></div>}
                        </>
                      ) : (
                        <p className="text-orange-600 text-xs flex items-center pl-6"><AlertTriangle className="w-3 h-3 mr-1"/> Not punched out yet.</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="p-4 border-t bg-background">
            <SheetClose asChild>
              <Button variant="outline" className="w-full">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      )}
    </div>
  );
}
