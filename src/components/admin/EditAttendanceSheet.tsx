
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
import type { ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Edit, MapPin, Note, PlusCircle, Save, Briefcase, Trash2 } from 'lucide-react';
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
    allProjects: ProjectForSelection[];
    onDataChange: () => void;
}

type EditorMode = 'list' | 'add' | 'edit';

const statusOptions: AttendanceOverrideStatus[] = ['present', 'absent', 'half-day', 'week-off', 'holiday', 'on-leave'];

export function EditAttendanceSheet({ isOpen, onOpenChange, dayData, userId, allProjects, onDataChange }: EditAttendanceSheetProps) {
    const { user: adminUser } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [mode, setMode] = useState<EditorMode>('list');
    
    // State for both editing and adding
    const [punchProjectId, setPunchProjectId] = useState<string>('');
    const [punchCheckIn, setPunchCheckIn] = useState('');
    const [punchCheckOut, setPunchCheckOut] = useState('');
    const [punchNotes, setPunchNotes] = useState('');
    const [currentLogId, setCurrentLogId] = useState<string | null>(null);

    // State for setting override status
    const [statusProjectId, setStatusProjectId] = useState<string>('');

    const resetForm = useCallback(() => {
        setPunchProjectId(allProjects.length > 0 ? allProjects[0].id : '');
        setPunchCheckIn('');
        setPunchCheckOut('');
        setPunchNotes('');
        setCurrentLogId(null);
        setStatusProjectId('');
    }, [allProjects]);

    useEffect(() => {
        if (isOpen) {
            setMode('list');
            resetForm();
            if (dayData?.logs?.length === 0 && allProjects.length > 0) {
                setStatusProjectId(allProjects[0].id);
            }
        }
    }, [isOpen, resetForm, dayData, allProjects]);

    const handleEditClick = (log: AttendanceLogForCalendar) => {
        setMode('edit');
        setCurrentLogId(log.id);
        setPunchProjectId(log.projectId);
        setPunchCheckIn(log.checkInTime ? format(parseISO(log.checkInTime), 'HH:mm') : '');
        setPunchCheckOut(log.checkOutTime ? format(parseISO(log.checkOutTime), 'HH:mm') : '');
        setPunchNotes(log.reviewNotes || '');
    };

    const handleAddClick = () => {
        resetForm();
        if(allProjects.length > 0) setPunchProjectId(allProjects[0].id);
        setMode('add');
    };

    const handleCancel = () => {
        setMode('list');
        resetForm();
    };

    const handleSetStatus = async (status: AttendanceOverrideStatus) => {
        if (!adminUser || !dayData) return;
        
        setIsSaving(true);
        let logToUpdateId: string | null = dayData.logs.length > 0 ? dayData.logs[0].id : null;
        let result;

        if (logToUpdateId) {
            result = await updateAttendanceLogByAdmin(adminUser.id, {
                logId: logToUpdateId,
                updates: {
                    overrideStatus: status,
                    reviewNotes: `Status manually set to '${status}' by admin.`
                }
            });
        } else {
            if (!statusProjectId) {
                toast({ title: "Project Required", description: "Please select a project to associate this status with.", variant: "destructive" });
                setIsSaving(false);
                return;
            }
            const payload: AddManualPunchPayload = {
                employeeId: userId,
                projectId: statusProjectId,
                date: format(dayData.date, 'yyyy-MM-dd'),
                overrideStatus: status,
                notes: `Status manually set to '${status}' by admin.`
            };
            result = await addManualPunchByAdmin(adminUser.id, payload);
        }
        
        if (result.success) {
            toast({ title: "Status Set", description: result.message });
            onDataChange();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSaving(false);
    }

    const handleSaveChanges = async () => {
        if (!adminUser || !dayData) return;
        
        setIsSaving(true);
        const datePart = format(dayData.date, 'yyyy-MM-dd');
        
        if (mode === 'edit' && currentLogId) {
            const newCheckIn = punchCheckIn ? new Date(`${datePart}T${punchCheckIn}`).toISOString() : null;
            const newCheckOut = punchCheckOut ? new Date(`${datePart}T${punchCheckOut}`).toISOString() : null;

            const result = await updateAttendanceLogByAdmin(adminUser.id, {
                logId: currentLogId,
                updates: { reviewNotes: punchNotes, checkInTime: newCheckIn, checkOutTime: newCheckOut }
            });
            if (result.success) {
                toast({ title: "Changes Saved", description: result.message });
                onDataChange();
                handleCancel();
            } else {
                toast({ title: "Error Saving", description: result.message, variant: "destructive" });
            }
        } else if (mode === 'add') {
            if (!punchProjectId) {
                toast({ title: "Project Required", description: "Please select a project.", variant: "destructive" });
                setIsSaving(false);
                return;
            }
             const payload: AddManualPunchPayload = {
                employeeId: userId,
                projectId: punchProjectId,
                date: datePart,
                checkInTime: punchCheckIn || undefined,
                checkOutTime: punchCheckOut || undefined,
                notes: punchNotes || undefined,
                overrideStatus: 'present', // Adding a punch implies presence
            };
            const result = await addManualPunchByAdmin(adminUser.id, payload);
            if (result.success) {
                toast({ title: "Manual Punch Added", description: result.message });
                onDataChange();
                handleCancel();
            } else {
                 toast({ title: "Error Adding Punch", description: result.message, variant: "destructive" });
            }
        }
        
        setIsSaving(false);
    };

    const renderListView = () => (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label className="font-semibold">Override Day Status</Label>
                <div className="text-xs text-muted-foreground">Sets an overall status for the day. This is useful for marking leave, holidays, or absences.</div>
                {dayData?.logs.length === 0 && (
                    <Select value={statusProjectId} onValueChange={setStatusProjectId}>
                        <SelectTrigger><SelectValue placeholder="Select Project for Status" /></SelectTrigger>
                        <SelectContent>
                            {allProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                <div className="grid grid-cols-3 gap-2">
                    {statusOptions.map(status => (
                        <Button key={status} variant="outline" size="sm" onClick={() => handleSetStatus(status)} disabled={isSaving}>
                            {status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Button>
                    ))}
                </div>
            </div>
            
            <div className="space-y-2">
                <Label className="font-semibold">Existing Punches</Label>
                {dayData?.logs && dayData.logs.length > 0 ? (
                    <div className="mt-2 space-y-2">
                        {dayData.logs.map((log, index) => (
                            <Card key={log.id} className="p-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium text-sm flex items-center gap-2"><Briefcase className="w-4 h-4"/>{allProjects.find(p=>p.id===log.projectId)?.name || 'Unknown Project'}</p>
                                        <p className="text-xs text-muted-foreground">Session {index + 1}</p>
                                        {log.overrideStatus && <Badge variant="secondary" className="mt-1">{log.overrideStatus.replace('-', ' ')}</Badge>}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(log)}><Edit className="w-4 h-4" /></Button>
                                </div>
                                <div className="text-sm mt-2 flex gap-4">
                                    <span>In: {log.checkInTime ? format(parseISO(log.checkInTime), 'p') : 'N/A'}</span>
                                    <span>Out: {log.checkOutTime ? format(parseISO(log.checkOutTime), 'p') : 'N/A'}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground mt-1 text-center py-4">No punches recorded for this day.</p>
                )}
            </div>
            <Button onClick={handleAddClick} variant="outline" className="w-full border-dashed"><PlusCircle className="mr-2 h-4 w-4"/> Add New Punch</Button>
        </div>
    );
    
    const renderFormView = () => (
        <div className="space-y-4">
            <h3 className="font-semibold">{mode === 'edit' ? 'Editing Punch' : 'Adding New Punch'}</h3>
            <div>
                <Label htmlFor="punch-project">Project</Label>
                <Select value={punchProjectId} onValueChange={setPunchProjectId} disabled={mode === 'edit'}>
                    <SelectTrigger id="punch-project"><SelectValue placeholder="Select a project" /></SelectTrigger>
                    <SelectContent>
                        {allProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                 {mode === 'edit' && <p className="text-xs text-muted-foreground mt-1">Project cannot be changed for an existing log.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label htmlFor="punch-in">Check-in</Label>
                    <Input id="punch-in" type="time" value={punchCheckIn} onChange={e => setPunchCheckIn(e.target.value)} />
                </div>
                <div>
                    <Label htmlFor="punch-out">Check-out</Label>
                    <Input id="punch-out" type="time" value={punchCheckOut} onChange={e => setPunchCheckOut(e.target.value)} />
                </div>
            </div>
            <div>
                <Label htmlFor="punch-notes">Admin Notes</Label>
                <Textarea id="punch-notes" placeholder="Notes for this specific punch" value={punchNotes} onChange={e => setPunchNotes(e.target.value)} />
            </div>
        </div>
    );

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="p-6 pb-4 border-b">
                    <SheetTitle className="font-headline text-xl">Manage Attendance</SheetTitle>
                    {dayData && <SheetDescription>For {format(dayData.date, 'PPP')}</SheetDescription>}
                </SheetHeader>

                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    {mode === 'list' ? renderListView() : renderFormView()}
                </div>
                
                <SheetFooter className="p-6 border-t bg-background">
                    {mode === 'list' ? (
                         <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
                    ) : (
                        <>
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSaveChanges} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                        </>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
