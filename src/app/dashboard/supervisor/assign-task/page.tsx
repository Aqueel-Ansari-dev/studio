
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, User, Briefcase, FileText, PlusCircle, MessageSquare, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context'; 
import { assignTask, AssignTaskInput, AssignTaskResult } from '@/app/actions/supervisor/assignTask';
import { fetchUsersByRole, UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, ProjectForSelection } from '@/app/actions/common/fetchAllProjects';

export default function AssignTaskPage() {
  const { user } = useAuth(); 
  const [employees, setEmployees] = useState<UserForSelection[]>([]);
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const { toast } = useToast();

  useEffect(() => {
    async function loadInitialData() {
      setLoadingEmployees(true);
      try {
        const fetchedEmployees = await fetchUsersByRole('employee');
        setEmployees(fetchedEmployees);
      } catch (error) {
        console.error("Error loading employees:", error)
        toast({ title: "Error", description: "Could not load employees.", variant: "destructive" });
      } finally {
        setLoadingEmployees(false);
      }

      setLoadingProjects(true);
      try {
        const fetchedProjects = await fetchAllProjects();
        setProjects(fetchedProjects);
      } catch (error) {
        console.error("Error loading projects:", error);
        toast({ title: "Error", description: "Could not load projects. Please ensure projects exist and Firestore rules allow access.", variant: "destructive" });
      } finally {
        setLoadingProjects(false);
      }
    }
    loadInitialData();
  }, [toast]);

  const resetForm = () => {
    setSelectedEmployee('');
    setSelectedProject('');
    setTaskName('');
    setTaskDescription('');
    setSupervisorNotes('');
    setDueDate(undefined);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "Supervisor ID not found. Please re-login.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (!dueDate) {
      setErrors(prev => ({ ...prev, dueDate: "Due date is required."}));
      toast({ title: "Validation Error", description: "Due date is required.", variant: "destructive"});
      setIsSubmitting(false);
      return;
    }
    
    const taskInput: AssignTaskInput = {
      employeeId: selectedEmployee,
      projectId: selectedProject,
      taskName,
      description: taskDescription || undefined,
      dueDate,
      supervisorNotes: supervisorNotes || undefined,
    };

    const result: AssignTaskResult = await assignTask(user.id, taskInput);

    if (result.success) {
      toast({
        title: "Task Assigned!",
        description: `"${taskName}" assigned successfully. Task ID: ${result.taskId}`,
      });
      console.log("Task assigned with ID:", result.taskId);
      resetForm();
    } else {
      if (result.errors) {
        const newErrors: Record<string, string | undefined> = {};
        result.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
         toast({
          title: "Validation Failed",
          description: result.message || "Please check the form for errors.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Assignment Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Assign New Task" description="Fill in the details below to assign a task to an employee." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Task Assignment Form</CardTitle>
          <CardDescription>Ensure all fields are accurately filled. Data for employees and projects are fetched from Firestore.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="employee">Assign to Employee <span className="text-destructive">*</span></Label>
                 <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select 
                    value={selectedEmployee} 
                    onValueChange={setSelectedEmployee} 
                    disabled={loadingEmployees || employees.length === 0}
                  >
                    <SelectTrigger id="employee" className="pl-10">
                      <SelectValue placeholder={loadingEmployees ? "Loading employees..." : (employees.length === 0 ? "No employees available" : "Select an employee")} />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingEmployees ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : employees.length > 0 ? (
                        employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                        ))
                      ) : (
                         <SelectItem value="no-employees" disabled>No employees found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {errors.employeeId && <p className="text-sm text-destructive mt-1">{errors.employeeId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Select Project <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select 
                    value={selectedProject} 
                    onValueChange={setSelectedProject} 
                    disabled={loadingProjects || projects.length === 0}
                  >
                    <SelectTrigger id="project" className="pl-10">
                      <SelectValue placeholder={loadingProjects ? "Loading projects..." : (projects.length === 0 ? "No projects available" : "Select a project")} />
                    </SelectTrigger>
                    <SelectContent>
                       {loadingProjects ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : projects.length > 0 ? (
                        projects.map(proj => (
                          <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-projects" disabled>No projects found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                 {errors.projectId && <p className="text-sm text-destructive mt-1">{errors.projectId}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskName">Task Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="taskName" 
                  placeholder="e.g., Install new server" 
                  value={taskName} 
                  onChange={(e) => setTaskName(e.target.value)} 
                  className="pl-10" 
                />
              </div>
              {errors.taskName && <p className="text-sm text-destructive mt-1">{errors.taskName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskDescription">Task Description (Optional)</Label>
              <Textarea 
                id="taskDescription" 
                placeholder="Provide a detailed description of the task..." 
                value={taskDescription} 
                onChange={(e) => setTaskDescription(e.target.value)}
                className="min-h-[100px]"
              />
               {errors.description && <p className="text-sm text-destructive mt-1">{errors.description}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supervisorNotes">Supervisor Notes (Optional)</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea 
                  id="supervisorNotes" 
                  placeholder="Add any specific instructions or notes for the employee..." 
                  value={supervisorNotes} 
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  className="min-h-[100px] pl-10"
                />
              </div>
              {errors.supervisorNotes && <p className="text-sm text-destructive mt-1">{errors.supervisorNotes}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal pl-10"
                  >
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} 
                  />
                </PopoverContent>
              </Popover>
              {errors.dueDate && <p className="text-sm text-destructive mt-1">{errors.dueDate}</p>}
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || loadingEmployees || loadingProjects || !selectedEmployee || !selectedProject || !taskName || !dueDate}>
                {isSubmitting ? "Assigning..." : <><PlusCircle className="mr-2 h-4 w-4" /> Assign Task</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

    