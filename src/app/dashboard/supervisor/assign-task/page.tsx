
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
import { CalendarIcon, User, Briefcase, FileText, PlusCircle, MessageSquare, RefreshCw, ListChecks, Trash2, FilePlus2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { assignTasksToEmployee, AssignTasksInput, AssignTasksResult } from '@/app/actions/supervisor/assignTask';
import { createQuickTaskForAssignment, CreateQuickTaskInput, CreateQuickTaskResult } from '@/app/actions/supervisor/createTask';
import { fetchUsersByRole, UserForSelection, FetchUsersByRoleResult } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { fetchAssignableTasksForProject, TaskForAssignment, FetchAssignableTasksResult } from '@/app/actions/supervisor/fetchTasks';

interface NewTaskEntry {
  localId: string; // For React key
  name: string;
  description: string;
}

export default function AssignTaskPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [assignableTasks, setAssignableTasks] = useState<TaskForAssignment[]>([]);
  
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasksForProject, setLoadingTasksForProject] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedExistingTaskIds, setSelectedExistingTaskIds] = useState<Record<string, boolean>>({});
  const [newTasksToAssign, setNewTasksToAssign] = useState<NewTaskEntry[]>([]);
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isImportant, setIsImportant] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({}); // For top-level form errors
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
    setSelectedExistingTaskIds({});
    setNewTasksToAssign([]);
    setAssignableTasks([]);
    if (!projectId) return;

    setLoadingTasksForProject(true);
    const result: FetchAssignableTasksResult = await fetchAssignableTasksForProject(projectId);
    if (result.success && result.tasks) {
      setAssignableTasks(result.tasks);
      if (result.tasks.length === 0) {
        toast({ title: "No Unassigned Tasks", description: "No unassigned tasks in this project. You can create new ones below.", variant: "info" });
      }
    } else {
      toast({ title: "Error loading tasks", description: result.error || "Could not load tasks.", variant: "destructive" });
      setAssignableTasks([]);
    }
    setLoadingTasksForProject(false);
  };

  const handleExistingTaskSelectionChange = (taskId: string, checked: boolean) => {
    setSelectedExistingTaskIds(prev => ({ ...prev, [taskId]: checked }));
  };

  const addNewTaskInput = () => {
    setNewTasksToAssign(prev => [...prev, { localId: crypto.randomUUID(), name: '', description: '' }]);
  };

  const handleNewTaskChange = (index: number, field: 'name' | 'description', value: string) => {
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
    setSelectedExistingTaskIds({});
    setNewTasksToAssign([]);
    setAssignableTasks([]);
    setSelectedEmployeeId('');
    setSupervisorNotes('');
    setDueDate(undefined);
    setIsImportant(false);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!user?.id) { toast({ title: "Authentication Error", variant: "destructive" }); return; }
    if (!selectedProjectId || !selectedEmployeeId || !dueDate) {
      toast({ title: "Missing Information", description: "Project, Employee, and Due Date are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const finalTaskIdsToAssign: string[] = Object.entries(selectedExistingTaskIds)
      .filter(([,isSelected]) => isSelected)
      .map(([taskId]) => taskId);
    
    let newTasksCreatedCount = 0;
    let newTasksFailedToCreate = 0;

    for (const newTask of newTasksToAssign) {
      if (newTask.name.trim() === '') continue;
      const quickTaskInput: CreateQuickTaskInput = {
        projectId: selectedProjectId,
        taskName: newTask.name,
        description: newTask.description,
      };
      const createTaskResult: CreateQuickTaskResult = await createQuickTaskForAssignment(user.id, quickTaskInput);
      if (createTaskResult.success && createTaskResult.taskId) {
        finalTaskIdsToAssign.push(createTaskResult.taskId);
        newTasksCreatedCount++;
      } else {
        newTasksFailedToCreate++;
        toast({ title: `Failed to Create Task "${newTask.name}"`, description: createTaskResult.message, variant: "destructive" });
      }
    }
    
    if (newTasksFailedToCreate > 0 && newTasksToAssign.filter(nt => nt.name.trim()).length === newTasksFailedToCreate && finalTaskIdsToAssign.length === newTasksCreatedCount) {
        // All attempts to create new tasks failed, and no existing tasks were selected to begin with (or only newly created ones were intended)
        toast({ title: "Task Creation Failed", description: `All ${newTasksFailedToCreate} new task(s) could not be created. Assignment halted.`, variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    if (finalTaskIdsToAssign.length === 0) {
      toast({ title: "No Tasks", description: "No tasks selected or created for assignment.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const assignInput: AssignTasksInput = {
      taskIds: finalTaskIdsToAssign,
      employeeId: selectedEmployeeId,
      projectId: selectedProjectId,
      dueDate,
      supervisorNotes: supervisorNotes || undefined,
      isImportant,
    };

    const assignResult: AssignTasksResult = await assignTasksToEmployee(user.id, assignInput);

    if (assignResult.success) {
      toast({ title: "Tasks Assigned!", description: `${assignResult.assignedCount} task(s) assigned successfully. ${newTasksCreatedCount > 0 ? `${newTasksCreatedCount} new task(s) were also created.` : '' }` });
      resetForm();
    } else {
      toast({ title: "Assignment Issue", description: assignResult.message || "Some tasks could not be assigned.", variant: "destructive" });
      if(assignResult.individualTaskErrors) {
          assignResult.individualTaskErrors.forEach(err => {
              toast({ title: `Error for task ID ${err.taskId.substring(0,6)}...`, description: err.error, variant: "destructive", duration: 7000 });
          });
      }
    }
    setIsSubmitting(false);
  };
  
  const isInitialLoading = loadingEmployees || loadingProjects;
  const canSubmit = !isSubmitting && !isInitialLoading && selectedProjectId && selectedEmployeeId && dueDate && 
                    (Object.values(selectedExistingTaskIds).some(Boolean) || newTasksToAssign.some(nt => nt.name.trim() !== ''));


  return (
    <div className="space-y-6">
      <PageHeader title="Assign Tasks to Employee" description="Select a project, choose existing tasks or create new ones, and assign them." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Task Assignment Form</CardTitle>
          <CardDescription>Fields with <span className="text-destructive">*</span> are required or derived.</CardDescription>
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
                    <SelectValue placeholder={loadingProjects ? "Loading projects..." : (projects.length === 0 ? "No projects" : "Select a project")} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2: Task Selection/Creation (conditional on project selection) */}
            {selectedProjectId && (
              <div className="space-y-4">
                {/* Existing Tasks Selection */}
                <div className="space-y-2">
                  <Label>2. Select Existing Tasks (Optional)</Label>
                  {loadingTasksForProject ? (
                    <p className="text-sm text-muted-foreground">Loading tasks for project...</p>
                  ) : assignableTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No existing assignable (unassigned, pending) tasks in this project.</p>
                  ) : (
                    <ScrollArea className="h-40 rounded-md border p-3">
                      <div className="space-y-2">
                        {assignableTasks.map(task => (
                          <div key={task.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`task-${task.id}`}
                              checked={!!selectedExistingTaskIds[task.id]}
                              onCheckedChange={(checked) => handleExistingTaskSelectionChange(task.id, !!checked)}
                            />
                            <Label htmlFor={`task-${task.id}`} className="font-normal cursor-pointer flex-grow">
                              {task.taskName}
                              {task.description && <span className="text-xs text-muted-foreground block truncate"> - {task.description}</span>}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* New Tasks Creation */}
                <div className="space-y-2">
                    <Label>Or, Add New Tasks for This Assignment (Optional)</Label>
                    {newTasksToAssign.map((newTask, index) => (
                    <Card key={newTask.localId} className="p-3 space-y-2 bg-muted/30 relative">
                        <div className="flex justify-between items-start">
                            <p className="text-sm font-medium text-muted-foreground">New Task {index + 1}</p>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeNewTaskInput(newTask.localId)} className="absolute top-1 right-1 h-6 w-6" title="Remove this new task">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                        <Input 
                            id={`newTaskName-${index}`}
                            placeholder="New Task Name" 
                            value={newTask.name} 
                            onChange={(e) => handleNewTaskChange(index, 'name', e.target.value)}
                            onKeyDown={(e) => handleNewTaskNameKeyDown(e, index)}
                        />
                        <Textarea 
                            placeholder="New Task Description (Optional)" 
                            value={newTask.description} 
                            onChange={(e) => handleNewTaskChange(index, 'description', e.target.value)}
                            rows={2}
                            className="text-sm"
                        />
                    </Card>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addNewTaskInput} className="mt-2">
                        <FilePlus2 className="mr-2 h-4 w-4" /> Add Another New Task
                    </Button>
                </div>
              </div>
            )}

            {/* Step 3 & 4: Employee, Due Date, Notes (conditional on project selection) */}
            {selectedProjectId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="employee">3. Assign to Employee <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={isInitialLoading || employees.length === 0}>
                      <SelectTrigger id="employee" className="pl-10">
                        <SelectValue placeholder={loadingEmployees ? "Loading employees..." : (employees.length === 0 ? "No employees" : "Select an employee")} />
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

                <div className="space-y-2">
                  <Label htmlFor="supervisorNotes">5. Supervisor Notes (Optional)</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea id="supervisorNotes" placeholder="Add any specific instructions..." value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} className="min-h-[80px] pl-10" />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="important" checked={isImportant} onCheckedChange={v => setIsImportant(!!v)} />
                  <Label htmlFor="important" className="font-normal">Mark as Important</Label>
                </div>
              </>
            )}

            <div className="pt-2">
              <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!canSubmit}>
                {isSubmitting ? "Processing Assignment..." : <><PlusCircle className="mr-2 h-4 w-4" /> Assign Task(s)</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

