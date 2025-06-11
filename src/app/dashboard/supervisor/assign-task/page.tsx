
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, User, Briefcase, MessageSquare, PlusCircle, RefreshCw, ListChecks, Trash2, FilePlus2, AlertTriangle, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { assignTasksToEmployee, AssignTasksInput, AssignTasksResult } from '@/app/actions/supervisor/assignTask';
// createQuickTaskForAssignment is now handled within assignTasksToEmployee if new tasks are passed
import { fetchUsersByRole, UserForSelection, FetchUsersByRoleResult } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { fetchAssignableTasksForProject, TaskForAssignment, FetchAssignableTasksResult } from '@/app/actions/supervisor/fetchTasks';

interface NewTaskEntry {
  localId: string; 
  name: string;
  description: string;
  isImportant: boolean;
}

interface ExistingTaskSelectionState {
  selectedForAssignment: boolean;
  isImportant: boolean; // Current desired "isImportant" state for this assignment
}


export default function AssignTaskPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [assignableTasks, setAssignableTasks] = useState<TaskForAssignment[]>([]); // Now includes current isImportant
  
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasksForProject, setLoadingTasksForProject] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [existingTaskSelections, setExistingTaskSelections] = useState<Record<string, ExistingTaskSelectionState>>({});
  const [newTasksToAssign, setNewTasksToAssign] = useState<NewTaskEntry[]>([]);
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({}); // Kept for future direct form validation if needed
  const { toast } = useToast();

  const loadInitialLookups = useCallback(async () => {
    setLoadingEmployees(true);
    setLoadingProjects(true);
    try {
      const [fetchedEmployeesResult, fetchedProjectsResult]: [FetchUsersByRoleResult, FetchAllProjectsResult] = await Promise.all([
        fetchUsersByRole('employee'),
        fetchAllProjects()
      ]);

      if (fetchedEmployeesResult.success && fetchedEmployeesResult.users) setEmployees(fetchedEmployeesResult.users);
      else {
        setEmployees([]);
        toast({ title: "Error loading employees", description: fetchedEmployeesResult.error || "Could not load employees.", variant: "destructive" });
      }

      if (fetchedProjectsResult.success && fetchedProjectsResult.projects) setProjects(fetchedProjectsResult.projects);
      else {
        setProjects([]);
        toast({ title: "Error loading projects", description: fetchedProjectsResult.error || "Could not load projects.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not load initial data.", variant: "destructive" });
    } finally {
      setLoadingEmployees(false);
      setLoadingProjects(false);
    }
  }, [toast]);

  useEffect(() => { loadInitialLookups(); }, [loadInitialLookups]);

  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setExistingTaskSelections({}); // Reset selections
    setNewTasksToAssign([]);
    setAssignableTasks([]);
    if (!projectId) return;

    setLoadingTasksForProject(true);
    const result: FetchAssignableTasksResult = await fetchAssignableTasksForProject(projectId);
    if (result.success && result.tasks) {
      setAssignableTasks(result.tasks);
      // Initialize existingTaskSelections based on fetched tasks
      const initialSelections: Record<string, ExistingTaskSelectionState> = {};
      result.tasks.forEach(task => {
        initialSelections[task.id] = { selectedForAssignment: false, isImportant: task.isImportant };
      });
      setExistingTaskSelections(initialSelections);

      if (result.tasks.length === 0) {
        toast({ title: "No Unassigned Tasks", description: "No unassigned tasks in this project. You can create new ones below.", variant: "info", duration: 5000 });
      }
    } else {
      toast({ title: "Error loading tasks", description: result.error || "Could not load tasks.", variant: "destructive" });
      setAssignableTasks([]);
    }
    setLoadingTasksForProject(false);
  };

  const handleExistingTaskSelectChange = (taskId: string, checked: boolean) => {
    setExistingTaskSelections(prev => ({ 
        ...prev, 
        [taskId]: { ...prev[taskId], selectedForAssignment: checked }
    }));
  };

  const handleExistingTaskImportanceChange = (taskId: string, checked: boolean) => {
     setExistingTaskSelections(prev => ({ 
        ...prev, 
        [taskId]: { ...prev[taskId], isImportant: checked }
    }));
  };


  const addNewTaskInput = () => {
    setNewTasksToAssign(prev => [...prev, { localId: crypto.randomUUID(), name: '', description: '', isImportant: false }]);
  };

  const handleNewTaskPropertyChange = (index: number, field: keyof NewTaskEntry, value: string | boolean) => {
    setNewTasksToAssign(prev => prev.map((task, i) => i === index ? { ...task, [field]: value } : task));
  };
  
  const handleNewTaskNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter' && index === newTasksToAssign.length - 1) {
      e.preventDefault();
      addNewTaskInput();
       setTimeout(() => {
        const nextInput = document.getElementById(`newTaskName-${newTasksToAssign.length}`);
        nextInput?.focus();
      }, 0);
    }
  };

  const removeNewTaskInput = (localId: string) => {
    setNewTasksToAssign(prev => prev.filter(task => task.localId !== localId));
  };

  const resetForm = () => {
    setSelectedProjectId('');
    setExistingTaskSelections({});
    setNewTasksToAssign([]);
    setAssignableTasks([]);
    setSelectedEmployeeId('');
    setSupervisorNotes('');
    setDueDate(undefined);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) { toast({ title: "Authentication Error", variant: "destructive" }); return; }
    if (!selectedProjectId || !selectedEmployeeId || !dueDate) {
      toast({ title: "Missing Information", description: "Project, Employee, and Due Date are required.", variant: "destructive" });
      return;
    }

    const finalExistingTasksToAssign = Object.entries(existingTaskSelections)
      .filter(([,details]) => details.selectedForAssignment)
      .map(([taskId, details]) => ({ taskId, isImportant: details.isImportant }));

    const finalNewTasksToCreate = newTasksToAssign
      .filter(nt => nt.name.trim() !== '')
      .map(nt => ({ name: nt.name, description: nt.description, isImportant: nt.isImportant }));

    if (finalExistingTasksToAssign.length === 0 && finalNewTasksToCreate.length === 0) {
      toast({ title: "No Tasks", description: "Please select at least one existing task or define at least one new task.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);

    const assignInput: AssignTasksInput = {
      existingTasksToAssign: finalExistingTasksToAssign.length > 0 ? finalExistingTasksToAssign : undefined,
      newTasksToCreateAndAssign: finalNewTasksToCreate.length > 0 ? finalNewTasksToCreate : undefined,
      employeeId: selectedEmployeeId,
      projectId: selectedProjectId,
      dueDate,
      supervisorNotes: supervisorNotes || undefined,
    };

    const assignResult: AssignTasksResult = await assignTasksToEmployee(user.id, assignInput);

    if (assignResult.success) {
      toast({ title: "Tasks Processed!", description: assignResult.message || "Tasks assigned/created successfully." });
      resetForm();
    } else {
      toast({ title: "Assignment Issue", description: assignResult.message || "Some tasks could not be processed.", variant: "destructive", duration: 7000 });
      if(assignResult.individualTaskErrors) {
          assignResult.individualTaskErrors.forEach(err => {
              const title = err.taskId 
                ? `Error for task ID ${err.taskId.substring(0,6)}...` 
                : (err.taskName ? `Error for new task "${err.taskName}"` : "Task Processing Error");
              toast({ title: title, description: err.error, variant: "destructive", duration: 10000 });
          });
      }
    }
    setIsSubmitting(false);
  };
  
  const isInitialLoading = loadingEmployees || loadingProjects;
  const selectedExistingCount = Object.values(existingTaskSelections).filter(v => v.selectedForAssignment).length;
  const newTasksDefinedCount = newTasksToAssign.filter(nt => nt.name.trim() !== '').length;

  const canSubmit = !isSubmitting && !isInitialLoading && selectedProjectId && selectedEmployeeId && dueDate && 
                    (selectedExistingCount > 0 || newTasksDefinedCount > 0);


  return (
    <div className="space-y-6">
      <PageHeader title="Assign Tasks to Employee" description="Select existing tasks or create new ones for a project, then assign them." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Task Assignment Form</CardTitle>
          <CardDescription>Fields with <span className="text-destructive">*</span> are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">1. Select Project <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select value={selectedProjectId} onValueChange={handleProjectChange} disabled={isInitialLoading || projects.length === 0}>
                  <SelectTrigger id="project" className="pl-10">
                    <SelectValue placeholder={loadingProjects ? "Loading projects..." : (projects.length === 0 ? "No projects available" : "Select a project")} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2: Task Selection/Creation (conditional on project selection) */}
            {selectedProjectId && (
              <Card className="p-4 border-dashed bg-muted/30">
                <CardHeader className="p-0 pb-3">
                    <CardTitle className="text-lg font-medium">2. Select or Create Tasks for This Assignment</CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                    {/* Existing Tasks Selection */}
                    <div className="space-y-2 p-3 border rounded-md bg-background">
                      <Label className="font-semibold">Existing Assignable Tasks in "{projects.find(p=>p.id === selectedProjectId)?.name || 'Project'}"</Label>
                      {loadingTasksForProject ? (
                          <p className="text-sm text-muted-foreground">Loading tasks...</p>
                      ) : assignableTasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">No existing unassigned tasks in this project.</p>
                      ) : (
                          <ScrollArea className="h-48 rounded-md border p-2">
                            <div className="space-y-1">
                                {assignableTasks.map(task => (
                                <div key={task.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                                    <Checkbox
                                      id={`assign-task-${task.id}`}
                                      checked={existingTaskSelections[task.id]?.selectedForAssignment || false}
                                      onCheckedChange={(checked) => handleExistingTaskSelectChange(task.id, !!checked)}
                                      className="shrink-0 mt-1"
                                    />
                                    <Label htmlFor={`assign-task-${task.id}`} className="font-normal cursor-pointer flex-grow space-y-0.5">
                                      <span className="block text-sm">{task.taskName}</span>
                                      {task.description && <span className="text-xs text-muted-foreground block truncate"> {task.description}</span>}
                                    </Label>
                                    <div className="flex items-center space-x-2 shrink-0">
                                        <Checkbox
                                          id={`important-task-${task.id}`}
                                          checked={existingTaskSelections[task.id]?.isImportant || false}
                                          onCheckedChange={(checked) => handleExistingTaskImportanceChange(task.id, !!checked)}
                                        />
                                        <Label htmlFor={`important-task-${task.id}`} className="text-xs font-normal">Important</Label>
                                    </div>
                                </div>
                                ))}
                            </div>
                          </ScrollArea>
                      )}
                    </div>

                    {/* New Tasks Creation */}
                    <div className="space-y-2 p-3 border rounded-md bg-background">
                        <Label className="font-semibold">Create New Tasks for This Assignment</Label>
                        {newTasksToAssign.map((newTask, index) => (
                          <Card key={newTask.localId} className="p-3 space-y-2 bg-muted/50 shadow-sm relative">
                              <div className="flex justify-between items-start mb-1">
                                  <p className="text-xs font-medium text-muted-foreground">New Task {index + 1}</p>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeNewTaskInput(newTask.localId)} className="absolute top-1 right-1 h-6 w-6" title="Remove this new task">
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                              </div>
                              <Input 
                                  id={`newTaskName-${index}`}
                                  placeholder="New Task Name (required)" 
                                  value={newTask.name} 
                                  onChange={(e) => handleNewTaskPropertyChange(index, 'name', e.target.value)}
                                  onKeyDown={(e) => handleNewTaskNameKeyDown(e, index)}
                                  className="h-9 text-sm"
                              />
                              <Textarea 
                                  placeholder="New Task Description (Optional)" 
                                  value={newTask.description} 
                                  onChange={(e) => handleNewTaskPropertyChange(index, 'description', e.target.value)}
                                  rows={1}
                                  className="text-xs min-h-[40px]"
                              />
                              <div className="flex items-center space-x-2 pt-1">
                                  <Checkbox 
                                      id={`newTaskImportant-${index}`}
                                      checked={newTask.isImportant}
                                      onCheckedChange={(checked) => handleNewTaskPropertyChange(index, 'isImportant', !!checked)}
                                  />
                                  <Label htmlFor={`newTaskImportant-${index}`} className="font-normal text-xs">Mark as Important</Label>
                              </div>
                          </Card>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addNewTaskInput} className="mt-2 border-dashed">
                            <FilePlus2 className="mr-2 h-4 w-4" /> Add New Task Row
                        </Button>
                    </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3 & 4: Employee, Due Date, Notes (conditional on project selection) */}
            {selectedProjectId && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                    <Label htmlFor="employee">3. Assign to Employee <span className="text-destructive">*</span></Label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={isInitialLoading || employees.length === 0}>
                        <SelectTrigger id="employee" className="pl-10">
                            <SelectValue placeholder={loadingEmployees ? "Loading employees..." : (employees.length === 0 ? "No employees available" : "Select an employee")} />
                        </SelectTrigger>
                        <SelectContent>
                            {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                    </div>

                    <div className="space-y-2">
                    <Label htmlFor="dueDate">4. Set Due Date <span className="text-destructive">*</span></Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button variant={"outline"} className="w-full justify-start text-left font-normal pl-10">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            {dueDate ? format(dueDate, "PPP") : <span>Pick a due date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} />
                        </PopoverContent>
                    </Popover>
                    </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supervisorNotes">5. Common Supervisor Notes (Optional)</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea id="supervisorNotes" placeholder="Add common instructions applicable to all assigned tasks..." value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} className="min-h-[80px] pl-10" />
                  </div>
                </div>
              </>
            )}

            <div className="pt-2">
              <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!canSubmit}>
                {isSubmitting ? "Processing Assignment..." : <><ListChecks className="mr-2 h-4 w-4" /> Assign Task(s)</>}
              </Button>
              {(!selectedProjectId || !selectedEmployeeId || !dueDate || (selectedExistingCount === 0 && newTasksDefinedCount === 0)) && !isSubmitting &&
                <p className="text-xs text-muted-foreground mt-2">Please select a project, employee, due date, and at least one task to enable assignment.</p>
              }
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
