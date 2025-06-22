
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { format, parseISO } from 'date-fns';
import { updateAttendanceLogByAdmin, addManualPunchByAdmin, type AddManualPunchPayload } from '@/app/actions/attendance';
import type { AttendanceLogForCalendar } from '@/app/actions/attendance';
import type { LeaveRequest, AttendanceOverrideStatus } from '@/types/database';
import type { ProjectWithId } from '@/app/actions/employee/fetchEmployeeData';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, Clock, MapPin, Note, PlusCircle, Save, Briefcase } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface EditAttendanceSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    dayData: {
        date: Date;
        logs: AttendanceLogForCalendar[];
        leaves: LeaveRequest[];
    } | null;
    userId: string;
    userProjects: ProjectWithId[];
    onDataChange: () => void;
}

const statusOptions: AttendanceOverrideStatus[] = ['present', 'absent', 'half-day', 'week-off', 'holiday', 'on-leave'];

export function EditAttendanceSheet({ isOpen, onOpenChange, dayData, userId, userProjects, onDataChange }: EditAttendanceSheetProps) {
    const { user: adminUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    // State for EDITING an existing log
    const [editableLog, setEditableLog] = useState<AttendanceLogForCalendar | null>(null);
    const [editNotes, setEditNotes] = useState('');
    const [editCheckInTime, setEditCheckInTime] = useState('');
    const [editCheckOutTime, setEditCheckOutTime] = useState('');

    // State for ADDING a new log
    const [newPunchProjectId, setNewPunchProjectId] = useState<string>('');
    const [newPunchCheckIn, setNewPunchCheckIn] = useState('');
    const [newPunchCheckOut, setNewPunchCheckOut] = useState('');
    const [newPunchNotes, setNewPunchNotes] = useState('');
    const [newPunchStatus, setNewPunchStatus] = useState<AttendanceOverrideStatus>('present');

    useEffect(() => {
        if (dayData && dayData.logs.length > 0) {
            const log = dayData.logs[0]; // For now, only edit the first log of the day
            setEditableLog(log);
            setEditNotes(log.reviewNotes || '');
            setEditCheckInTime(log.checkInTime ? format(parseISO(log.checkInTime), 'HH:mm') : '');
            setEditCheckOutTime(log.checkOutTime ? format(parseISO(log.checkOutTime), 'HH:mm') : '');
        } else if(dayData && dayData.logs.length === 0){
            setEditableLog(null);
            setNewPunchProjectId(userProjects.length > 0 ? userProjects[0].id : '');
            setNewPunchCheckIn('');
            setNewPunchCheckOut('');
            setNewPunchNotes('');
            setNewPunchStatus('present');
        }
    }, [dayData, userProjects]);

    const handleStatusChange = async (newStatus: AttendanceOverrideStatus) => {
        if (!adminUser) return;
        setIsSaving(true);
        
        if (editableLog) {
            const result = await updateAttendanceLogByAdmin(adminUser.id, {
                logId: editableLog.id,
                updates: { overrideStatus: newStatus }
            });
            if (result.success) {
                toast({ title: "Status Updated", description: result.message });
                setEditableLog(prev => prev ? { ...prev, overrideStatus: newStatus } : null);
                onDataChange(); 
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } else {
             setNewPunchStatus(newStatus);
        }
        setIsSaving(false);
    };

    const handleSaveChanges = async () => {
        if (!adminUser || !dayData) return;
        
        setIsSaving(true);

        if (editableLog) { // Updating existing log
            const datePart = format(dayData.date, 'yyyy-MM-dd');
            const newCheckIn = editCheckInTime ? new Date(`${datePart}T${editCheckInTime}`).toISOString() : null;
            const newCheckOut = editCheckOutTime ? new Date(`${datePart}T${editCheckOutTime}`).toISOString() : null;

            const result = await updateAttendanceLogByAdmin(adminUser.id, {
                logId: editableLog.id,
                updates: { 
                    reviewNotes: editNotes,
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

        } else { // Adding a new manual punch
            if (!newPunchProjectId) {
                toast({ title: "Project Required", description: "Please select a project for the manual punch.", variant: "destructive" });
                setIsSaving(false);
                return;
            }
            const payload: AddManualPunchPayload = {
                employeeId: userId,
                projectId: newPunchProjectId,
                date: format(dayData.date, 'yyyy-MM-dd'),
                checkInTime: newPunchCheckIn || undefined,
                checkOutTime: newPunchCheckOut || undefined,
                notes: newPunchNotes || undefined,
                overrideStatus: newPunchStatus
            };
            const result = await addManualPunchByAdmin(adminUser.id, payload);
            if (result.success) {
                toast({ title: "Manual Punch Added", description: result.message });
                onDataChange();
                onOpenChange(false);
            } else {
                 toast({ title: "Error Adding Punch", description: result.message, variant: "destructive" });
            }
        }
        setIsSaving(false);
    };
    
    const activeStatus = editableLog?.overrideStatus || newPunchStatus || (dayData?.logs.length ? 'present' : 'absent');

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="p-6 pb-4 border-b">
                    <SheetTitle className="font-headline text-xl">Edit Attendance</SheetTitle>
                    {dayData && <SheetDescription>For {format(dayData.date, 'PPP')}</SheetDescription>}
                </SheetHeader>

                <div className="flex-grow overflow-y-auto p-6 space-y-6">
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

                    {editableLog ? (
                        <div className="space-y-3">
                            <Label className="font-medium">Punch Details</Label>
                            <Card className="p-3 bg-muted/50">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <Input type="time" value={editCheckInTime} onChange={(e) => setEditCheckInTime(e.target.value)} />
                                        <Badge variant="secondary">In</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <Input type="time" value={editCheckOutTime} onChange={(e) => setEditCheckOutTime(e.target.value)} />
                                        <Badge variant="destructive">Out</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1"><MapPin className="w-3 h-3"/> Location data available.</p>
                                </div>
                            </Card>
                            <Label htmlFor="admin-notes" className="font-medium">Admin Notes</Label>
                             <Textarea id="admin-notes" placeholder="Add notes..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Label className="font-medium">Add Manual Punch</Label>
                             <Card className="p-3 bg-muted/50 space-y-4">
                                <div>
                                    <Label htmlFor="new-punch-project">Project</Label>
                                    <Select value={newPunchProjectId} onValueChange={setNewPunchProjectId}>
                                        <SelectTrigger id="new-punch-project"><SelectValue placeholder="Select a project"/></SelectTrigger>
                                        <SelectContent>
                                            {userProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <Input type="time" value={newPunchCheckIn} onChange={(e) => setNewPunchCheckIn(e.target.value)} />
                                    <Badge variant="secondary">In</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <Input type="time" value={newPunchCheckOut} onChange={(e) => setNewPunchCheckOut(e.target.value)} />
                                    <Badge variant="destructive">Out</Badge>
                                </div>
                                <div>
                                     <Label htmlFor="new-punch-notes">Notes</Label>
                                     <Textarea id="new-punch-notes" value={newPunchNotes} onChange={(e) => setNewPunchNotes(e.target.value)} />
                                </div>
                             </Card>
                        </div>
                    )}
                </div>
                
                <SheetFooter className="p-6 border-t bg-background">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
