
"use client";

import { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, User, Briefcase, FileText, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Mock data
const mockEmployees = [
  { id: "emp1", name: "Alice Smith" },
  { id: "emp2", name: "Bob Johnson" },
  { id: "emp3", name: "Carol White" },
];

const mockProjects = [
  { id: "proj1", name: "Downtown Office Build" },
  { id: "proj2", name: "Residential Complex Maintenance" },
  { id: "proj3", name: "City Park Landscaping" },
];

export default function AssignTaskPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!selectedEmployee || !selectedProject || !taskName || !dueDate) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields.",
        variant: "destructive",
      });
      return;
    }
    // In a real app, this would call an API to assign the task
    console.log({
      employeeId: selectedEmployee,
      projectId: selectedProject,
      name: taskName,
      description: taskDescription,
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
    });
    toast({
      title: "Task Assigned!",
      description: `"${taskName}" assigned to ${mockEmployees.find(emp => emp.id === selectedEmployee)?.name || 'Employee'} for project ${mockProjects.find(proj => proj.id === selectedProject)?.name || 'Project'}.`,
    });
    // Reset form
    setSelectedEmployee('');
    setSelectedProject('');
    setTaskName('');
    setTaskDescription('');
    setDueDate(undefined);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Assign New Task" description="Fill in the details below to assign a task to an employee." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Task Assignment Form</CardTitle>
          <CardDescription>Ensure all fields are accurately filled.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="employee">Assign to Employee</Label>
                 <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger id="employee" className="pl-10">
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Select Project</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger id="project" className="pl-10">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockProjects.map(proj => (
                        <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskName">Task Name</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="taskName" placeholder="e.g., Install new server" value={taskName} onChange={(e) => setTaskName(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskDescription">Task Description</Label>
              <Textarea 
                id="taskDescription" 
                placeholder="Provide a detailed description of the task..." 
                value={taskDescription} 
                onChange={(e) => setTaskDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
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
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Assign Task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
