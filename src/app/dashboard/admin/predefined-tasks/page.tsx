"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { addPredefinedTask, deletePredefinedTask, fetchPredefinedTasks, type AddPredefinedTaskInput } from '@/app/actions/admin/managePredefinedTasks';
import type { PredefinedTask, UserRole } from '@/types/database';
import { PlusCircle, RefreshCw, Trash2, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type TargetRole = 'employee' | 'supervisor' | 'all';

// Constants for caching
const PREDEFINED_TASKS_CACHE_KEY = 'predefined_tasks_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export default function PredefinedTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<PredefinedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskTargetRole, setNewTaskTargetRole] = useState<TargetRole>('all');

  const loadTasks = useCallback(async (useCache = true) => {
    let cachedData = null;
    if (useCache) {
      try {
        const rawCache = localStorage.getItem(PREDEFINED_TASKS_CACHE_KEY);
        if (rawCache) {
          cachedData = JSON.parse(rawCache);
          const { tasks: cachedTasks, timestamp } = cachedData;
          if (cachedTasks && Array.isArray(cachedTasks) && (Date.now() - timestamp < CACHE_DURATION)) {
            setTasks(cachedTasks);
            setIsLoading(false); // Display cached data immediately
            console.log('Loaded predefined tasks from cache.');
          } else {
            console.log('Cached predefined tasks expired or invalid, fetching fresh data.');
            localStorage.removeItem(PREDEFINED_TASKS_CACHE_KEY); // Clear expired cache
          }
        }
      } catch (e) {
        console.warn('Failed to load predefined tasks from cache', e);
        localStorage.removeItem(PREDEFINED_TASKS_CACHE_KEY); // Clear corrupt cache
      }
    }

    // Always fetch fresh data in the background
    setIsLoading(true); // Show loading indicator until fresh data arrives
    try {
      const result = await fetchPredefinedTasks();
      if (result.success && result.tasks) {
        setTasks(result.tasks);
        localStorage.setItem(PREDEFINED_TASKS_CACHE_KEY, JSON.stringify({ tasks: result.tasks, timestamp: Date.now() }));
        console.log('Successfully fetched and cached new predefined tasks.');
      } else {
        toast({ title: "Error", description: result.error || "Could not load predefined tasks.", variant: "destructive" });
        if (!cachedData) { // If no cache was used or it was invalid, set tasks to empty on error
          setTasks([]);
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred while fetching tasks.", variant: "destructive" });
      if (!cachedData) {
        setTasks([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!newTaskName.trim() || !newTaskTargetRole) {
      toast({ title: "Validation Error", description: "Task name and target role are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const input: AddPredefinedTaskInput = {
      name: newTaskName,
      description: newTaskDescription,
      targetRole: newTaskTargetRole,
    };
    const result = await addPredefinedTask(user.id, input);
    if (result.success) {
      toast({ title: "Task Added", description: `'${newTaskName}' has been added to the library.` });
      setNewTaskName('');
      setNewTaskDescription('');
      setNewTaskTargetRole('all');
      loadTasks(false); // Refresh list and bypass cache for immediate consistency
    } else {
      toast({ title: "Failed to Add Task", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteTask = async (taskId: string) => {
      if (!user?.id) return;
      setIsDeleting(taskId);
      const result = await deletePredefinedTask(user.id, taskId);
      if(result.success) {
          toast({ title: "Task Deleted", description: result.message });
          setTasks(prev => prev.filter(t => t.id !== taskId));
          // Update cache after deletion for immediate consistency
          const rawCache = localStorage.getItem(PREDEFINED_TASKS_CACHE_KEY);
          if (rawCache) {
            try {
              const cachedData = JSON.parse(rawCache);
              if (cachedData && Array.isArray(cachedData.tasks)) {
                const updatedCachedTasks = cachedData.tasks.filter((t: PredefinedTask) => t.id !== taskId);
                localStorage.setItem(PREDEFINED_TASKS_CACHE_KEY, JSON.stringify({ tasks: updatedCachedTasks, timestamp: Date.now() }));
              }
            } catch (e) {
              console.warn('Failed to update cache after delete', e);
              localStorage.removeItem(PREDEFINED_TASKS_CACHE_KEY);
            }
          }
      } else {
          toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
      }
      setIsDeleting(null);
  };
  
  const roleDisplayMap: Record<TargetRole, string> = {
      employee: "Employee",
      supervisor: "Supervisor",
      all: "All Roles"
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Predefined Tasks" description="Manage reusable task templates for faster task assignment." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2"><PlusCircle/>Add New Task Template</CardTitle>
            </CardHeader>
            <form onSubmit={handleAddTask}>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="newTaskName">Task Name <span className="text-destructive">*</span></Label>
                  <Input id="newTaskName" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="e.g., Conduct Safety Check" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="newTaskDescription">Description (Optional)</Label>
                  <Textarea id="newTaskDescription" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} placeholder="Default description for this task" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="newTaskTargetRole">Target Role <span className="text-destructive">*</span></Label>
                    <Select value={newTaskTargetRole} onValueChange={(value: TargetRole) => setNewTaskTargetRole(value)}>
                        <SelectTrigger id="newTaskTargetRole">
                            <SelectValue placeholder="Select who this task is for" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="employee">Employee Only</SelectItem>
                            <SelectItem value="supervisor">Supervisor Only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                  Add Task to Library
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2"><ListChecks/>Task Library</CardTitle>
              <CardDescription>
                {isLoading ? "Loading tasks..." : `Showing ${tasks.length} predefined task(s).` }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && tasks.length === 0 ? ( // Only show full loading if no tasks (not even cached ones) are present
                <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin" /></div>
              ) : tasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-10">No predefined tasks found. Add one to get started.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>For Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map(task => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-sm truncate">{task.description || "N/A"}</TableCell>
                        <TableCell>
                            <Badge variant={task.targetRole === 'all' ? 'outline' : 'secondary'}>{roleDisplayMap[task.targetRole]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isDeleting === task.id}>
                                  {isDeleting === task.id ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete the "{task.name}" template. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTask(task.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                           </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
