
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, UserCheck, RefreshCw, MapPin, Briefcase, Camera, ClockIcon, MessageSquare } from "lucide-react";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { attendanceAnomalyDetection, AttendanceAnomalyDetectionOutput } from "@/ai/flows/attendance-anomaly-detection";
import { fetchAttendanceLogsForSupervisorReview, AttendanceLogForSupervisorView, updateAttendanceReviewStatus, UpdateAttendanceReviewStatusResult } from '@/app/actions/attendance';
import type { AttendanceReviewStatus } from '@/types/database';
import Image from "next/image";
import { format, parseISO, isValid } from 'date-fns';

interface UIAttendanceLog extends AttendanceLogForSupervisorView {
  isLoadingAi?: boolean;
  aiAnalysis?: AttendanceAnomalyDetectionOutput;
  isProcessingReview?: boolean; // For loading state on approve/reject buttons
}

export default function AttendanceReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [allLogs, setAllLogs] = useState<UIAttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [logToReject, setLogToReject] = useState<UIAttendanceLog | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const loadAttendanceLogs = useCallback(async () => {
    if (!user?.id) {
      if (!authLoading) toast({ title: "Authentication Error", description: "Please log in.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await fetchAttendanceLogsForSupervisorReview(user.id);
      if (result.success && result.logs) {
        setAllLogs(result.logs.map(log => ({ ...log, reviewStatus: log.reviewStatus || 'pending' })));
      } else {
        toast({ title: "Error Loading Logs", description: result.error || "Could not fetch attendance logs.", variant: "destructive" });
        setAllLogs([]);
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred while fetching logs.", variant: "destructive" });
      setAllLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      loadAttendanceLogs();
    }
  }, [loadAttendanceLogs, authLoading, user]);


  const runAiAnalysis = async (logId: string) => {
    setAllLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isLoadingAi: true } : log));
    
    const logToAnalyze = allLogs.find(log => log.id === logId);
    if (!logToAnalyze) return;

    try {
      const aiResult = await attendanceAnomalyDetection({
        attendanceLog: `Employee: ${logToAnalyze.employeeName}, Date: ${logToAnalyze.date}, Check-in: ${format(parseISO(logToAnalyze.checkInTime), 'p')}, Check-out: ${logToAnalyze.checkOutTime ? format(parseISO(logToAnalyze.checkOutTime), 'p') : 'N/A'}`,
        taskDetails: `Project: ${logToAnalyze.projectName}`, 
        gpsData: `Check-in Location: Lat ${logToAnalyze.gpsLocationCheckIn.lat.toFixed(4)}, Lng ${logToAnalyze.gpsLocationCheckIn.lng.toFixed(4)}. Accuracy: ${logToAnalyze.gpsLocationCheckIn.accuracy?.toFixed(0) ?? 'N/A'}m. Timestamp: ${logToAnalyze.gpsLocationCheckIn.timestamp ? format(new Date(logToAnalyze.gpsLocationCheckIn.timestamp), 'p') : 'N/A'}`,
        supervisorNotes: "Regular shift.", 
        pastAssignmentData: "Employee has consistent past performance."
      });

      setAllLogs(prevLogs => prevLogs.map(log => 
        log.id === logId ? { ...log, aiAnalysis: aiResult, isLoadingAi: false } : log
      ));
      toast({ title: "AI Analysis Complete", description: `Analysis for ${logToAnalyze.employeeName}'s log finished.` });
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAllLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isLoadingAi: false } : log));
      toast({ title: "AI Error", description: "Could not complete AI analysis.", variant: "destructive" });
    }
  };
  
  const handleReviewAction = async (logId: string, newStatus: AttendanceReviewStatus, notes?: string) => {
    if (!user?.id) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        return;
    }
    setAllLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isProcessingReview: true } : log));

    const result: UpdateAttendanceReviewStatusResult = await updateAttendanceReviewStatus({
      logId,
      reviewerId: user.id,
      status: newStatus,
      reviewNotes: notes,
    });

    if (result.success && result.updatedLog) {
      toast({ title: `Log ${newStatus}`, description: `Attendance for ${result.updatedLog.employeeName} has been ${newStatus}.`});
      setAllLogs(prevLogs => prevLogs.map(log => 
        log.id === logId ? { ...log, ...result.updatedLog, isProcessingReview: false, aiAnalysis: undefined } : log
      ));
    } else {
      toast({ title: `Failed to ${newStatus} Log`, description: result.message, variant: "destructive"});
      setAllLogs(prevLogs => prevLogs.map(log => log.id === logId ? { ...log, isProcessingReview: false } : log));
    }
  };

  const openRejectionDialog = (log: UIAttendanceLog) => {
    setLogToReject(log);
    setRejectionNotes(log.reviewNotes || "");
    setShowRejectionDialog(true);
  };

  const submitRejection = () => {
    if (logToReject) {
      handleReviewAction(logToReject.id, 'rejected', rejectionNotes);
    }
    setShowRejectionDialog(false);
    setLogToReject(null);
    setRejectionNotes("");
  };


  const openImageModal = (imageUrl: string) => {
    setModalImageUrl(imageUrl);
    setShowImageModal(true);
  };

  const logsForReview = allLogs.filter(log => log.reviewStatus === 'pending');
  const processedLogs = allLogs.filter(log => log.reviewStatus === 'approved' || log.reviewStatus === 'rejected');
  
  const SelfieAndGpsCell = ({ log, type }: { log: UIAttendanceLog, type: 'checkIn' | 'checkOut' }) => {
    const selfieUrl = type === 'checkIn' ? log.selfieCheckInUrl : log.selfieCheckOutUrl;
    const gpsData = type === 'checkIn' ? log.gpsLocationCheckIn : log.gpsLocationCheckOut;
    const time = type === 'checkIn' ? log.checkInTime : log.checkOutTime;

    if (!time && type === 'checkOut') return <TableCell className="text-xs text-muted-foreground">N/A</TableCell>;
    if (!gpsData && type === 'checkOut' && !selfieUrl) return <TableCell className="text-xs text-muted-foreground">N/A</TableCell>;

    let timeDisplay = 'N/A';
    if (time) {
        try {
            timeDisplay = format(parseISO(time), 'p');
        } catch (e) {
            console.warn("Failed to parse time:", time, e);
        }
    }
    
    let gpsTimeDisplay = 'N/A';
    if (gpsData?.timestamp) {
        try {
            gpsTimeDisplay = format(new Date(gpsData.timestamp), 'p');
        } catch(e) {
            console.warn("Failed to parse GPS timestamp:", gpsData.timestamp, e);
        }
    }


    return (
      <TableCell>
        <div className="flex flex-col space-y-1">
          {time && <div className="flex items-center text-xs"><ClockIcon className="w-3 h-3 mr-1 text-muted-foreground"/>{timeDisplay}</div>}
          {selfieUrl ? (
            <button onClick={() => openImageModal(selfieUrl)} className="focus:outline-none focus:ring-2 focus:ring-primary rounded-md" aria-label={`View ${type} selfie`}>
              <Image src={selfieUrl} alt={`${type} selfie`} width={48} height={48} className="rounded-md object-cover border" data-ai-hint={`${type === 'checkIn' ? 'checkin' : 'checkout'} selfie`}/>
            </button>
          ) : (
            <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
              <Camera className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          {gpsData && (
            <div className="text-xs text-muted-foreground mt-0.5">
              <div className="flex items-center"><MapPin className="w-3 h-3 mr-1"/>Lat: {gpsData.lat.toFixed(3)}, Lng: {gpsData.lng.toFixed(3)}</div>
              {gpsData.timestamp && <div className="flex items-center"><ClockIcon className="w-3 h-3 mr-1"/>GPS Time: {gpsTimeDisplay}</div>}
            </div>
          )}
        </div>
      </TableCell>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Attendance Review" 
        description="Review employee attendance logs. Use AI analysis for insights."
        actions={
          <Button onClick={loadAttendanceLogs} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Logs
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Logs Requiring Attention ({logsForReview.length})</CardTitle>
          <CardDescription>Review logs and take appropriate action. Trigger AI analysis for insights.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><RefreshCw className="mr-2 h-6 w-6 animate-spin" /> Loading logs...</div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check-in Details</TableHead>
                <TableHead>Check-out Details</TableHead>
                <TableHead>AI Insights</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsForReview.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Image src={log.employeeAvatar} alt={log.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                      <span className="font-medium">{log.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center text-xs">
                        <Briefcase className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                        {log.projectName}
                    </div>
                  </TableCell>
                  <TableCell>{log.date}</TableCell>
                  <SelfieAndGpsCell log={log} type="checkIn" />
                  <SelfieAndGpsCell log={log} type="checkOut" />
                  <TableCell>
                    {log.isLoadingAi ? (
                      <span className="text-xs text-muted-foreground">Analyzing...</span>
                    ) : log.aiAnalysis ? (
                      log.aiAnalysis.anomalyDetected ? (
                        <div className="text-xs text-destructive">
                          <p className="flex items-center"><AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />{log.aiAnalysis.anomalyDetails}</p>
                          {log.aiAnalysis.recommendedAction && <p className="mt-0.5 text-muted-foreground">Action: {log.aiAnalysis.recommendedAction}</p>}
                        </div>
                      ) : (
                        <div className="text-xs text-green-600 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                          No anomalies detected.
                        </div>
                      )
                    ) : (
                      <Button variant="link" size="sm" onClick={() => runAiAnalysis(log.id)} className="p-0 h-auto text-xs" disabled={log.isProcessingReview}>Run AI Check</Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openRejectionDialog(log)} className="border-destructive text-destructive hover:bg-destructive/10" disabled={log.isProcessingReview}>
                        {log.isProcessingReview ? "..." : "Reject"}
                    </Button>
                    <Button size="sm" onClick={() => handleReviewAction(log.id, 'approved')} className="bg-green-500 hover:bg-green-600" disabled={log.isProcessingReview}>
                        {log.isProcessingReview ? "..." : "Approve"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logsForReview.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                    No attendance logs currently require review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="font-headline">Reviewed Logs ({processedLogs.length})</CardTitle>
          <CardDescription>Attendance logs that have been marked as Approved or Rejected by a supervisor.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
            <div className="text-center py-4"><RefreshCw className="mr-2 h-6 w-6 animate-spin" /> Loading logs...</div>
          ) : (
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Check-in Time</TableHead>
                <TableHead>Check-out Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Review Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
             {processedLogs.map((log) => (
                <TableRow key={log.id}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                        <Image src={log.employeeAvatar} alt={log.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                        <span className="font-medium">{log.employeeName}</span>
                        </div>
                    </TableCell>
                    <TableCell>{log.date}</TableCell>
                    <TableCell>{log.projectName}</TableCell>
                    <TableCell>{log.checkInTime && isValid(parseISO(log.checkInTime)) ? format(parseISO(log.checkInTime), 'p') : 'N/A'}</TableCell>
                    <TableCell>{log.checkOutTime && isValid(parseISO(log.checkOutTime)) ? format(parseISO(log.checkOutTime), 'p') : 'N/A'}</TableCell>
                    <TableCell>
                        <Badge variant={log.reviewStatus === 'approved' ? 'default' : 'destructive'}
                        className={log.reviewStatus === 'approved' ? 'bg-green-500 text-white' : ''}>
                        {log.reviewStatus?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.reviewedBy || 'N/A'} <br/> {log.reviewedAt && isValid(parseISO(log.reviewedAt)) ? format(parseISO(log.reviewedAt), 'PPp') : ''}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{log.reviewNotes || 'N/A'}</TableCell>
                </TableRow>
             ))}
             {processedLogs.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                    No logs have been reviewed yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
           </Table>
           )}
        </CardContent>
       </Card>

      <Dialog open={showRejectionDialog} onOpenChange={(isOpen) => { if(!isOpen) setLogToReject(null); setShowRejectionDialog(isOpen); }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Attendance Log</DialogTitle>
                <DialogDescription>
                    Provide notes for rejecting the attendance log of {logToReject?.employeeName} for project {logToReject?.projectName} on {logToReject?.date}.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="rejectionNotes">Rejection Notes (Optional)</Label>
                <Textarea 
                    id="rejectionNotes"
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    placeholder="e.g., Selfie unclear, GPS location mismatch..."
                    className="mt-1"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>Cancel</Button>
                <Button variant="destructive" onClick={submitRejection} disabled={logToReject?.isProcessingReview}>
                    {logToReject?.isProcessingReview ? "Rejecting..." : "Confirm Rejection"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl p-2">
          <DialogHeader className="sr-only"> 
            <DialogTitle>Selfie Preview</DialogTitle>
          </DialogHeader>
          {modalImageUrl && (
            <div className="relative w-full aspect-square max-h-[80vh]">
              <Image 
                src={modalImageUrl} 
                alt="Selfie Preview" 
                layout="fill"
                objectFit="contain"
                data-ai-hint="selfie preview"
              />
            </div>
          )}
          <DialogFooter className="pt-2 pr-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
