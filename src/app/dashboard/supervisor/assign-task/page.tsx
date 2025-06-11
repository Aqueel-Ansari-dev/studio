
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
import { CalendarIcon, User, Briefcase, FileText, PlusCircle, MessageSquare, RefreshCw, ListFilter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { assignExistingTaskToEmployee, AssignExistingTaskInput, AssignTaskResult } from '@/app/actions/supervisor/assignTask';
import { fetchUsersByRole, UserForSelection, FetchUsersByRoleResult } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection, FetchAllProjectsResult } from '@/app/actions/common/fetchAllProjects';
import { fetchAssignableTasksForProject, TaskForAssignment, FetchAssignableTasksResult } from '@/app/actions/supervisor/fetchTasks';

export default function AssignTaskPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [assignableTasks, setAssignableTasks] = useState<TaskForAssignment[]>([]);
  
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasksForProject, setLoadingTasksForProject] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<TaskForAssignment | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isImportant, setIsImportant] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const { toast } = useToast();

  const loadInitialLookups = useCallback(async () => {
    setLoadingEmployees(true);
    setLoadingProjects(true);
    try {
      const [fetchedEmployeesResult, fetchedProjectsResult]: [FetchUsersByRoleResult, FetchAllProjectsResult] = await Promise.all([
        fetchUsersByRole('employee'),
        fetchAllProjects()
      ]);

      if (fetchedEmployeesResult.success && fetchedEmployeesResult.users) {
        setEmployees(fetchedEmployeesResult.users);
      } else {
        setEmployees([]);
        toast({ title: "Error loading employees", description: fetchedEmployeesResult.error || "Could not load employees.", variant: "destructive" });
      }

      if (fetchedProjectsResult.success && fetchedProjectsResult.projects) {
        setProjects(fetchedProjectsResult.projects);
      } else {
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

  useEffect(() => {
    loadInitialLookups();
  }, [loadInitialLookups]);

  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedTaskId(''); // Reset task selection
    setSelectedTaskDetails(null);
    setAssignableTasks([]);
    if (!projectId) return;

    setLoadingTasksForProject(true);
    const result: FetchAssignableTasksResult = await fetchAssignableTasksForProject(projectId);
    if (result.success && result.tasks) {
      setAssignableTasks(result.tasks);
      if (result.tasks.length === 0) {
        toast({ title: "No Assignable Tasks", description: "No pending tasks without an assignee found in this project.", variant: "info" });
      }
    } else {
      toast({ title: "Error loading tasks", description: result.error || "Could not load tasks for this project.", variant: "destructive" });
      setAssignableTasks([]);
    }
    setLoadingTasksForProject(false);
  };

  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    const taskDetail = assignableTasks.find(t => t.id === taskId) || null;
    setSelectedTaskDetails(taskDetail);
    // Optionally prefill due date, notes, importance if they existed on the task object (not currently fetched by fetchAssignableTasksForProject)
    // For now, they are fresh inputs for assignment.
    setDueDate(undefined); 
    setSupervisorNotes('');
    setIsImportant(false);
  };

  const resetForm = () => {
    setSelectedProjectId('');
    setSelectedTaskId('');
    setSelectedTaskDetails(null);
    setSelectedEmployeeId('');
    setSupervisorNotes('');
    setDueDate(undefined);
    setIsImportant(false);
    setAssignableTasks([]);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!user?.id) {
      toast({ title: "Authentication Error", variant: "destructive" }); return;
    }
    if (!selectedTaskId || !selectedEmployeeId || !dueDate || !selectedProjectId) {
      toast({ title: "Missing Information", description: "Please select a project, task, employee, and set a due date.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const taskInput: AssignExistingTaskInput = {
      taskId: selectedTaskId,
      employeeId: selectedEmployeeId,
      projectId: selectedProjectId, // Project ID is known from selected project
      dueDate,
      supervisorNotes: supervisorNotes || undefined,
      isImportant,
    };

    const result: AssignTaskResult = await assignExistingTaskToEmployee(user.id, taskInput);

    if (result.success) {
      toast({ title: "Task Assigned!", description: result.message });
      resetForm();
    } else {
      if (result.errors) {
        const newErrors: Record<string, string | undefined> = {};
        result.errors.forEach(err => { newErrors[err.path[0] as string] = err.message; });
        setErrors(newErrors);
        toast({ title: "Validation Failed", description: result.message || "Please check the form for errors.", variant: "destructive"});
      } else {
        toast({ title: "Assignment Failed", description: result.message, variant: "destructive" });
      }
    }
    setIsSubmitting(false);
  };
  
  const isInitialLoading = loadingEmployees || loadingProjects;

  return (
    <div className="space-y-6">
      <PageHeader title="Assign Existing Task" description="Select a project, then an unassigned task, and assign it to an employee." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Task Assignment Form</CardTitle>
          <CardDescription>Fields with <span className="text-destructive">*</span> are required or derived.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Select Project */}
            <div className="space-y-2">
              <Label htmlFor="project">1. Select Project <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedProjectId}
                  onValueChange={handleProjectChange}
                  disabled={isInitialLoading || projects.length === 0}
                >
                  <SelectTrigger id="project" className="pl-10">
                    <SelectValue placeholder={loadingProjects ? "Loading projects..." : (projects.length === 0 ? "No projects" : "Select a project")} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {errors.projectId && <p className="text-sm text-destructive mt-1">{errors.projectId}</p>}
            </div>

            {/* Step 2: Select Task from Project */}
            {selectedProjectId && (
              <div className="space-y-2">
                <Label htmlFor="taskToAssign">2. Select Task to Assign <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedTaskId}
                    onValueChange={handleTaskChange}
                    disabled={loadingTasksForProject || assignableTasks.length === 0}
                  >
                    <SelectTrigger id="taskToAssign" className="pl-10">
                      <SelectValue placeholder={loadingTasksForProject ? "Loading tasks..." : (assignableTasks.length === 0 ? "No assignable tasks in project" : "Select a task")} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableTasks.map(task => <SelectItem key={task.id} value={task.id}>{task.taskName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                 {errors.taskId && <p className="text-sm text-destructive mt-1">{errors.taskId}</p>}
              </div>
            )}

            {/* Selected Task Details (Read-only) */}
            {selectedTaskDetails && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-md font-semibold">Selected Task: {selectedTaskDetails.taskName}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground pt-0">
                  <p className="line-clamp-3">{selectedTaskDetails.description || "No description provided for this task."}</p>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Assign to Employee */}
            {selectedTaskId && (
                 <div className="space-y-2">
                    <Label htmlFor="employee">3. Assign to Employee <span className="text-destructive">*</span></Label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Select
                        value={selectedEmployeeId}
                        onValueChange={setSelectedEmployeeId}
                        disabled={isInitialLoading || employees.length === 0}
                        >
                        <SelectTrigger id="employee" className="pl-10">
                            <SelectValue placeholder={loadingEmployees ? "Loading employees..." : (employees.length === 0 ? "No employees" : "Select an employee")} />
                        </SelectTrigger>
                        <SelectContent>
                            {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                    {errors.employeeId && <p className="text-sm text-destructive mt-1">{errors.employeeId}</p>}
                </div>
            )}
            
            {/* Due Date, Notes, Importance - only if task and employee selected */}
            {selectedTaskId && selectedEmployeeId && (
                <>
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
                    {errors.dueDate && <p className="text-sm text-destructive mt-1">{errors.dueDate}</p>}
                    </div>

                    <div className="space-y-2">
                    <Label htmlFor="supervisorNotes">5. Supervisor Notes (Optional)</Label>
                    <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea id="supervisorNotes" placeholder="Add any specific instructions..." value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} className="min-h-[80px] pl-10" />
                    </div>
                    {errors.supervisorNotes && <p className="text-sm text-destructive mt-1">{errors.supervisorNotes}</p>}
                    </div>

                    <div className="flex items-center space-x-2">
                    <Checkbox id="important" checked={isImportant} onCheckedChange={v => setIsImportant(!!v)} />
                    <Label htmlFor="important">Mark as Important</Label>
                    </div>
                </>
            )}

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" 
                disabled={isSubmitting || isInitialLoading || loadingTasksForProject || !selectedProjectId || !selectedTaskId || !selectedEmployeeId || !dueDate}
              >
                {isSubmitting ? "Assigning Task..." : <><PlusCircle className="mr-2 h-4 w-4" /> Assign Task to Employee</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
