
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { format, parseISO } from 'date-fns';
import { updateAttendanceLogByAdmin, addManualPunchByAdmin } from '@/app/actions/admin/attendance';
import type { AttendanceLogForCalendar } from '@/app/actions/attendance';
import type { LeaveRequest, AttendanceOverrideStatus } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, Clock, MapPin, Note, PlusCircle, Save } from 'lucide-react';

interface EditAttendanceSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    dayData: {
        date: Date;
        logs: AttendanceLogForCalendar[];
        leaves: LeaveRequest[];
    } | null;
    userId: string;
    onDataChange: () => void;
}

const statusOptions: AttendanceOverrideStatus[] = ['present', 'absent', 'half-day', 'week-off', 'holiday', 'on-leave'];
const leaveStatusOptions: AttendanceOverrideStatus[] = ['on-leave']; // A simplified mapping for leave types

export function EditAttendanceSheet({ isOpen, onOpenChange, dayData, userId, onDataChange }: EditAttendanceSheetProps) {
    const { user: adminUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    // State to hold the log we are editing. For now, we only edit the first log of the day.
    const [editableLog, setEditableLog] = useState<AttendanceLogForCalendar | null>(null);
    const [notes, setNotes] = useState('');
    const [checkInTime, setCheckInTime] = useState('');
    const [checkOutTime, setCheckOutTime] = useState('');

    useEffect(() => {
        if (dayData && dayData.logs.length > 0) {
            const log = dayData.logs[0];
            setEditableLog(log);
            setNotes(log.reviewNotes || '');
            setCheckInTime(log.checkInTime ? format(parseISO(log.checkInTime), 'HH:mm') : '');
            setCheckOutTime(log.checkOutTime ? format(parseISO(log.checkOutTime), 'HH:mm') : '');
        } else {
            setEditableLog(null);
            setNotes('');
            setCheckInTime('');
            setCheckOutTime('');
        }
    }, [dayData]);

    const handleStatusChange = async (newStatus: AttendanceOverrideStatus) => {
        if (!adminUser || !editableLog) return;
        setIsSaving(true);
        const result = await updateAttendanceLogByAdmin(adminUser.id, {
            logId: editableLog.id,
            updates: { overrideStatus: newStatus }
        });
        if (result.success) {
            toast({ title: "Status Updated", description: result.message });
            onDataChange(); // Refresh calendar
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSaving(false);
    };

    const handleSaveChanges = async () => {
        if (!adminUser || !editableLog) return;
        
        const datePart = format(dayData!.date, 'yyyy-MM-dd');
        const newCheckIn = checkInTime ? new Date(`${datePart}T${checkInTime}`).toISOString() : null;
        const newCheckOut = checkOutTime ? new Date(`${datePart}T${checkOutTime}`).toISOString() : null;

        setIsSaving(true);
        const result = await updateAttendanceLogByAdmin(adminUser.id, {
            logId: editableLog.id,
            updates: { 
                reviewNotes: notes,
                checkInTime: newCheckIn,
                checkOutTime: newCheckOut,
             }
        });
        if (result.success) {
            toast({ title: "Changes Saved", description: result.message });
            onDataChange();
            onOpenChange(false);
        } else {
            toast({ title: "Error Saving", description: result.message, variant: "destructive" });
        }
        setIsSaving(false);
    };
    
    const activeStatus = editableLog?.overrideStatus || (dayData?.logs.length ? 'present' : 'absent');

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="p-6 pb-4 border-b">
                    <SheetTitle className="font-headline text-xl">Edit Attendance</SheetTitle>
                    {dayData && <SheetDescription>For {format(dayData.date, 'PPP')}</SheetDescription>}
                </SheetHeader>

                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    {/* Status Selection */}
                    <div className="space-y-2">
                        <Label>Mark Status</Label>
                        <div className="flex flex-wrap gap-2">
                            {statusOptions.map(status => (
                                <Button 
                                    key={status}
                                    variant={activeStatus === status ? "default" : "outline"}
                                    size="sm"
                                    className={cn(activeStatus === 'present' && status === 'present' && "bg-green-500 hover:bg-green-600")}
                                    onClick={() => handleStatusChange(status)}
                                    disabled={isSaving}
                                >
                                    {status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Punch Details */}
                    <div className="space-y-3">
                        <Label className="font-medium">Punch Details</Label>
                        {dayData?.logs.map((log, index) => (
                            <Card key={log.id} className="p-3 bg-muted/50">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Session {index + 1}</p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <Input type="time" value={index === 0 ? checkInTime : (log.checkInTime ? format(parseISO(log.checkInTime), 'HH:mm') : '')} onChange={(e) => index === 0 && setCheckInTime(e.target.value)} disabled={index > 0}/>
                                        <Badge variant="secondary">In</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <Input type="time" value={index === 0 ? checkOutTime : (log.checkOutTime ? format(parseISO(log.checkOutTime), 'HH:mm') : '')} onChange={(e) => index === 0 && setCheckOutTime(e.target.value)} disabled={index > 0}/>
                                        <Badge variant="destructive">Out</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1"><MapPin className="w-3 h-3"/> Location data available.</p>
                                </div>
                            </Card>
                        ))}
                         {dayData?.logs.length === 0 && <p className="text-sm text-muted-foreground">No punch data for this day.</p>}
                         <Button variant="link" className="p-0 h-auto text-primary"><PlusCircle className="w-4 h-4 mr-1"/> Add Punch (Not implemented)</Button>
                    </div>

                    {/* Notes Section */}
                    <div className="space-y-2">
                         <Label htmlFor="admin-notes" className="font-medium">Admin Notes</Label>
                         <Textarea
                            id="admin-notes"
                            placeholder="Add notes for this attendance record..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[100px]"
                            disabled={!editableLog}
                         />
                    </div>
                </div>
                
                <SheetFooter className="p-6 border-t bg-background">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving || !editableLog}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

// Placeholder for a future server action
async function addManualPunchByAdmin() {
  console.log("addManualPunchByAdmin not implemented");
}
