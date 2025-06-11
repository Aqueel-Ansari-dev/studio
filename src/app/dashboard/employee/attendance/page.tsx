
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Camera, Check, ChevronLeft, ChevronRight, Clock, Eye, MapPin, RefreshCw, Briefcase } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchAttendanceLogsForEmployeeByMonth, AttendanceLogForCalendar } from '@/app/actions/attendance';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { format, parseISO, isValid, differenceInSeconds, addMonths, subMonths, startOfMonth } from 'date-fns';

export default function EmployeeAttendanceCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [attendanceLogsForMonth, setAttendanceLogsForMonth] = useState<AttendanceLogForCalendar[]>([]);
  const [projectsMap, setProjectsMap] = useState<Map<string, string>>(new Map());
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateLogs, setSelectedDateLogs] = useState<AttendanceLogForCalendar[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const result = await fetchAllProjects();
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
  }, [toast]);

  const loadAttendanceData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1; // date-fns month is 0-indexed, server action expects 1-indexed
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

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(startOfMonth(month));
  };

  const handleDayClick = (day: Date) => {
    const logsOnDay = attendanceLogsForMonth.filter(log => {
        const logDate = parseISO(log.date);
        return isValid(logDate) && 
               logDate.getFullYear() === day.getFullYear() &&
               logDate.getMonth() === day.getMonth() &&
               logDate.getDate() === day.getDate();
    });
    setSelectedDate(day);
    setSelectedDateLogs(logsOnDay);
    if (logsOnDay.length > 0) {
      setIsModalOpen(true);
    } else {
      toast({ title: "No Attendance", description: `No attendance logged on ${format(day, "PPP")}.`});
    }
  };
  
  const openImageModal = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    // This relies on another dialog or a state to show full image; for simplicity, not adding another one now.
    // If needed, a separate Dialog component for image viewing can be added.
    // For now, clicking will just log or do nothing more if not implemented.
    console.log("Attempting to view image:", imageUrl);
  };

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
    if (!selectedDateLogs.length) return "0h 0m";
    let totalSeconds = 0;
    selectedDateLogs.forEach(log => {
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
  }, [selectedDateLogs]);

  const attendedDays = useMemo(() => {
    return attendanceLogsForMonth.map(log => parseISO(log.date)).filter(isValid);
  }, [attendanceLogsForMonth]);

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

      <Card className="shadow-lg">
        <CardContent className="p-2 sm:p-4 md:p-6">
            {isLoading ? (
                <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(day) => day ? handleDayClick(day) : setSelectedDate(null)}
                month={currentMonth}
                onMonthChange={handleMonthChange}
                className="rounded-md border w-full"
                modifiers={{ attended: attendedDays }}
                modifiersClassNames={{ attended: 'bg-primary/20 rounded-full text-primary-foreground font-bold' }}
                components={{
                  Caption: ({ displayMonth }) => (
                    <div className="flex justify-between items-center px-2 py-2 relative">
                      <Button variant="outline" size="icon" onClick={() => handleMonthChange(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="font-medium">{format(displayMonth, "MMMM yyyy")}</h2>
                      <Button variant="outline" size="icon" onClick={() => handleMonthChange(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                }}
              />
            )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-headline">
              Attendance for {selectedDate ? format(selectedDate, "PPP") : "Selected Date"}
            </DialogTitle>
            <DialogDescription>
              Total time worked: <span className="font-semibold text-primary">{totalTimeForDay}</span>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-4 -mr-4">
            <div className="space-y-4 py-4">
              {selectedDateLogs.length === 0 ? (
                <p className="text-muted-foreground text-center">No attendance records for this day.</p>
              ) : (
                selectedDateLogs.map((log, index) => (
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
                        {log.selfieCheckInUrl && (
                           <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => openImageModal(log.selfieCheckInUrl!)}>
                             <Camera className="w-4 h-4"/>
                           </Button>
                        )}
                      </div>
                      {log.gpsLocationCheckIn && (
                        <p className="text-xs text-muted-foreground pl-6 flex items-center">
                          <MapPin className="w-3 h-3 mr-1"/> 
                          Lat: {log.gpsLocationCheckIn.lat.toFixed(3)}, Lng: {log.gpsLocationCheckIn.lng.toFixed(3)}
                          {log.gpsLocationCheckIn.accuracy && ` (Acc: ${log.gpsLocationCheckIn.accuracy.toFixed(0)}m)`}
                        </p>
                      )}

                      {log.checkOutTime ? (
                        <>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-red-600" />
                            Check-out: {format(parseISO(log.checkOutTime), 'p')}
                             {log.selfieCheckOutUrl && (
                                <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => openImageModal(log.selfieCheckOutUrl!)}>
                                 <Camera className="w-4 h-4"/>
                               </Button>
                             )}
                          </div>
                          {log.gpsLocationCheckOut && (
                            <p className="text-xs text-muted-foreground pl-6 flex items-center">
                                <MapPin className="w-3 h-3 mr-1"/>
                                Lat: {log.gpsLocationCheckOut.lat.toFixed(3)}, Lng: {log.gpsLocationCheckOut.lng.toFixed(3)}
                                {log.gpsLocationCheckOut.accuracy && ` (Acc: ${log.gpsLocationCheckOut.accuracy.toFixed(0)}m)`}
                            </p>
                          )}
                           {log.sessionNotes && <p className="text-xs italic mt-1 pl-6">Notes: {log.sessionNotes}</p>}
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
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simple image modal (can be improved) */}
      <Dialog open={!!modalImageUrl} onOpenChange={(open) => { if(!open) setModalImageUrl(null); }}>
        <DialogContent className="sm:max-w-md p-2">
          <DialogHeader className="sr-only"><DialogTitle>Selfie Preview</DialogTitle></DialogHeader>
          {modalImageUrl && <Image src={modalImageUrl} alt="Selfie preview" width={400} height={400} className="rounded-md object-contain max-h-[80vh]" data-ai-hint="selfie preview" />}
           <DialogFooter className="pt-2"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
