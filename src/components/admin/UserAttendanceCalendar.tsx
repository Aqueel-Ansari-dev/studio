
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RefreshCw, Briefcase, User, Calendar, Coffee, Plane, HeartPulse, ShieldQuestion } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchAttendanceLogsForEmployeeByMonth, type AttendanceLogForCalendar } from '@/app/actions/attendance';
import type { LeaveRequest, AttendanceOverrideStatus } from '@/types/database';
import type { ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth,
  isSameDay,
  isPast,
  isToday,
  addMonths,
  subMonths,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';
import { EditAttendanceSheet } from './EditAttendanceSheet';

interface UserAttendanceCalendarProps {
  userId: string;
  allLeaveRequests: LeaveRequest[];
  allProjects: ProjectForSelection[];
}

type DayStatus = 'present' | 'absent' | 'leave' | 'weekend' | 'future' | 'today' | 'holiday' | 'half-day';

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

export function UserAttendanceCalendar({ userId, allLeaveRequests, allProjects }: UserAttendanceCalendarProps) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [logs, setLogs] = useState<AttendanceLogForCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<{ date: Date; logs: AttendanceLogForCalendar[]; leaves: LeaveRequest[] } | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1; // server action is 1-indexed
      const result = await fetchAttendanceLogsForEmployeeByMonth(userId, year, month);
      if (result.success && result.logs) {
        setLogs(result.logs);
      } else {
        toast({ title: 'Error loading attendance', description: result.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to fetch attendance logs.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, userId, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  
  const handleDayClick = (day: Date) => {
    if (isPast(day) || isToday(day)) {
        const logsForDay = logs.filter(log => isSameDay(parseISO(log.date), day));
        const leavesForDay = allLeaveRequests.filter(req => {
            const start = parseISO(req.fromDate);
            const end = parseISO(req.toDate);
            return req.status === 'approved' && day >= start && day <= end;
        });
        setSelectedDayData({ date: day, logs: logsForDay, leaves: leavesForDay });
        setIsSheetOpen(true);
    } else {
        toast({title: "Future Date", description: "Cannot view or edit attendance for a future date."})
    }
  };


  const attendanceSets = useMemo(() => {
    const presentDays = new Set<string>();
    const overrideStatusDays = new Map<string, string>();

    logs.forEach(log => {
        if(log.date && parseISO(log.date)) {
            const dayStr = format(parseISO(log.date), 'yyyy-MM-dd');
            if (log.overrideStatus) {
                overrideStatusDays.set(dayStr, log.overrideStatus);
            } else {
                presentDays.add(dayStr);
            }
        }
    });
    
    const approvedLeaveDays = new Set<string>();
    allLeaveRequests
      .filter(req => req.status === 'approved')
      .forEach(req => {
        const start = parseISO(req.fromDate);
        const end = parseISO(req.toDate);
        if(!isNaN(start.valueOf()) && !isNaN(end.valueOf())) {
            const interval = eachDayOfInterval({ start, end });
            interval.forEach(day => {
                if (isSameMonth(day, currentMonth)) {
                    approvedLeaveDays.add(format(day, 'yyyy-MM-dd'));
                }
            });
        }
      });
    return { presentDays, approvedLeaveDays, overrideStatusDays };
  }, [logs, allLeaveRequests, currentMonth]);

  const attendanceStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    let present = 0;
    let absent = 0;
    let leave = 0;
    let weekOff = 0;
    let holiday = 0;
    let halfDay = 0;

    daysInMonth.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);

        const override = attendanceSets.overrideStatusDays.get(dayStr);
        if (override) {
            if (override === 'present') present++;
            else if (override === 'absent') absent++;
            else if (override === 'holiday') holiday++;
            else if (override === 'week-off') weekOff++;
            else if (override === 'half-day') halfDay++;
            else if (override === 'on-leave') leave++;
        } else if (attendanceSets.approvedLeaveDays.has(dayStr)) {
            leave++;
        } else if (attendanceSets.presentDays.has(dayStr)) {
            present++;
        } else if (dayOfWeek === 0) { // Sunday
            weekOff++;
        } else if (isPast(day) && !isToday(day)) {
            absent++;
        }
    });

    return { present, absent, leave, weekOff, holiday, halfDay };
  }, [currentMonth, attendanceSets]);

  const daysToRender = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDay = getDay(monthStart); // 0 for Sunday
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const leadingEmptyDays = Array.from({ length: startDay }, (_, i) => new Date(0));
    return [...leadingEmptyDays, ...days];
  }, [currentMonth]);


  const getDayStatus = useCallback((day: Date): DayStatus | string => {
    if (isToday(day)) return 'today';

    const dayStr = format(day, 'yyyy-MM-dd');
    const dayOfWeek = getDay(day);

    const override = attendanceSets.overrideStatusDays.get(dayStr);
    if(override) return override;

    if (attendanceSets.approvedLeaveDays.has(dayStr)) return 'leave';
    if (attendanceSets.presentDays.has(dayStr)) return 'present';
    if (dayOfWeek === 0) return 'weekend';
    if (isPast(day)) return 'absent';
    return 'future';
  }, [attendanceSets]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="font-headline">Attendance Calendar</CardTitle>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2 mb-4">
            <StatCard label="Present" count={attendanceStats.present} colorClass="bg-green-100 text-green-800" icon={Calendar} />
            <StatCard label="Absent" count={attendanceStats.absent} colorClass="bg-red-100 text-red-800" icon={Calendar} />
            <StatCard label="On Leave" count={attendanceStats.leave} colorClass="bg-yellow-100 text-yellow-800" icon={Plane} />
            <StatCard label="Half Days" count={attendanceStats.halfDay} colorClass="bg-purple-100 text-purple-800" icon={Calendar} />
            <StatCard label="Holidays" count={attendanceStats.holiday} colorClass="bg-blue-100 text-blue-800" icon={Calendar} />
            <StatCard label="Week Off" count={attendanceStats.weekOff} colorClass="bg-gray-100 text-gray-800" icon={Coffee} />
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground border-b pb-2">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        {isLoading ? (
            <div className="h-96 flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin" /></div>
        ) : (
        <div className="grid grid-cols-7 gap-1.5 mt-2">
          {daysToRender.map((day, index) => {
            if (day.getFullYear() === 1970) {
              return <div key={`empty-${index}`} />;
            }
            const status = getDayStatus(day);
            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "h-14 sm:h-16 rounded-md flex flex-col items-center justify-center p-1 text-sm border focus:outline-none focus:ring-2 focus:ring-primary focus:z-10",
                  !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-30 bg-gray-50",
                  status === 'present' && "bg-green-100 text-green-900 font-bold border-green-200",
                  status === 'absent' && "bg-red-100 text-red-900 border-red-200",
                  status === 'leave' && "bg-yellow-100 text-yellow-900 border-yellow-200",
                  status === 'half-day' && "bg-purple-100 text-purple-900 border-purple-200",
                  status === 'holiday' && "bg-blue-100 text-blue-900 border-blue-200",
                  status === 'weekend' && "bg-gray-100 text-gray-500 border-gray-200",
                  status === 'future' && "bg-white text-gray-700 cursor-not-allowed",
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

      {selectedDayData && (
        <EditAttendanceSheet 
            isOpen={isSheetOpen}
            onOpenChange={setIsSheetOpen}
            dayData={selectedDayData}
            onDataChange={fetchLogs}
            userId={userId}
            allProjects={allProjects}
        />
      )}
    </Card>
  );
}
