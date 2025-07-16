
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchAllProjects, type ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { fetchMyTasksForProject } from '@/app/actions/employee/fetchEmployeeData';
import type { TaskWithId } from '@/app/actions/employee/fetchEmployeeData';
import { reportIssue, ReportIssueInput, ReportIssueResult } from '@/app/actions/issues/issueActions';
import type { IssueSeverity } from '@/types/database';
import { AlertTriangle, Send, RefreshCw, Briefcase, ListChecks, Type, Signal, FileWarning, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const reportIssueFormSchema = z.object({
  projectId: z.string().min(1, 'Project selection is required.'),
  taskId: z.string().optional(),
  title: z.string().min(5, 'Title must be at least 5 characters.').max(100),
  description: z.string().min(10, 'Please provide a detailed description (min 10 characters).').max(1000),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
});

type ReportIssueFormValues = z.infer<typeof reportIssueFormSchema>;

export default function ReportIssuePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [tasks, setTasks] = useState<TaskWithId[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const form = useForm<ReportIssueFormValues>({
    resolver: zodResolver(reportIssueFormSchema),
    defaultValues: {
        projectId: '',
        severity: 'Medium',
    }
  });

  const selectedProjectId = form.watch('projectId');

  const loadProjects = useCallback(async () => {
    if (!user?.id) return;
    setLoadingLookups(true);
    const result = await fetchAllProjects(user.id);
    if (result.success && result.projects) {
      setProjects(result.projects);
    } else {
        toast({title: "Error", description: "Could not load projects.", variant: "destructive"})
    }
    setLoadingLookups(false);
  }, [user?.id, toast]);
  
  const loadTasks = useCallback(async (projectId: string) => {
    if (!user?.id) return;
    const result = await fetchMyTasksForProject(user.id, projectId);
    if (result.success && result.tasks) {
      setTasks(result.tasks);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadProjects();
    }
  }, [user, loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      loadTasks(selectedProjectId);
    } else {
      setTasks([]);
    }
  }, [selectedProjectId, loadTasks]);

  const onSubmit = async (data: ReportIssueFormValues) => {
    if (!user) return;
    // TODO: Add location and media upload logic here
    const result = await reportIssue(user.id, data);
    if (result.success) {
      toast({ title: 'Issue Reported', description: 'Your issue has been successfully submitted for review.' });
      router.push('/dashboard');
    } else {
      toast({ title: 'Submission Failed', description: result.message, variant: 'destructive' });
    }
  };

  const severityOptions: IssueSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report an Issue"
        description="Describe a problem or safety concern encountered on-site."
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <FileWarning /> Issue Details
              </CardTitle>
              <CardDescription>
                Provide as much detail as possible. All fields with <span className="text-destructive">*</span> are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField name="projectId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingLookups}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="taskId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Task (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedProjectId || tasks.length === 0}>
                       <FormControl><SelectTrigger><SelectValue placeholder="Select a task" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.taskName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <FormField name="title" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Title <span className="text-destructive">*</span></FormLabel>
                   <FormControl><Input {...field} placeholder="e.g., Water Leak in Basement" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField name="description" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-destructive">*</span></FormLabel>
                   <FormControl><Textarea {...field} placeholder="Describe the issue in detail..." className="min-h-[120px]" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField name="severity" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                       <FormControl><SelectTrigger><SelectValue placeholder="Select severity level" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {severityOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-2">
                    <Label>Attach Media (Optional)</Label>
                    <Button type="button" variant="outline" className="w-full">
                        <Camera className="mr-2 h-4 w-4" /> Upload Photo/Video
                    </Button>
                </div>
              </div>

            </CardContent>
            <CardFooter>
              <Button type="submit" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Issue Report
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
