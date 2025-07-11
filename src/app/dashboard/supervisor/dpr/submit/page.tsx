
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Briefcase, Percent, ImagePlus, FileText, Send, RefreshCw, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { submitDPR, type SubmitDPRInput } from '@/app/actions/supervisor/submitDPR';
import { fetchSupervisorAssignedProjects, type ProjectForSelection } from '@/app/actions/supervisor/fetchSupervisorData';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

const dprFormSchema = z.object({
  projectId: z.string().min(1, "Project is required."),
  reportDate: z.date(),
  progressPercentage: z.number().min(0).max(100),
  summary: z.string().min(10, "Summary must be at least 10 characters.").max(1000),
  notes: z.string().max(2000).optional(),
  issuesOrDelays: z.string().max(1000).optional(),
  siteConditions: z.string().max(200).optional(),
});

type DPRFormValues = z.infer<typeof dprFormSchema>;

export default function SubmitDPRPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);

  const form = useForm<DPRFormValues>({
    resolver: zodResolver(dprFormSchema),
    defaultValues: {
      reportDate: new Date(),
      progressPercentage: 0,
      summary: '',
      notes: '',
      issuesOrDelays: '',
      siteConditions: ''
    }
  });

  const loadProjects = useCallback(async () => {
    if (!user?.id) return;
    setLoadingProjects(true);
    const result = await fetchSupervisorAssignedProjects(user.id);
    if (result.success && result.projects) {
      setProjects(result.projects);
    } else {
      toast({ title: 'Error', description: 'Could not load your assigned projects.', variant: 'destructive' });
    }
    setLoadingProjects(false);
  }, [user?.id, toast]);

  useEffect(() => {
    if (user && !authLoading) {
      loadProjects();
    }
  }, [user, authLoading, loadProjects]);
  
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const allFiles = [...mediaFiles, ...newFiles].slice(0, 5); // Limit to 5 files
      setMediaFiles(allFiles);
      
      const newPreviews = allFiles.map(file => URL.createObjectURL(file));
      setMediaPreviews(newPreviews);
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(files => files.filter((_, i) => i !== index));
    setMediaPreviews(previews => previews.filter((_, i) => i !== index));
  };
  
  const onSubmit = async (data: DPRFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    
    const mediaDataUris: string[] = [];
    for (const file of mediaFiles) {
        const reader = new FileReader();
        const promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        mediaDataUris.push(await promise);
    }

    const input: SubmitDPRInput = { ...data, mediaDataUris };
    
    const result = await submitDPR(user.id, input);
    
    if (result.success) {
        toast({ title: 'DPR Submitted', description: 'Your Daily Progress Report has been successfully submitted.' });
        form.reset();
        setMediaFiles([]);
        setMediaPreviews([]);
        router.push('/dashboard/supervisor/overview'); // Redirect to overview after success
    } else {
        toast({ title: 'Submission Failed', description: result.message, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Submit Daily Progress Report (DPR)" description="Fill out the report for one of your assigned projects." />
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Core Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Controller name="projectId" control={form.control} render={({ field }) => (
                    <div>
                      <Label>Project <span className="text-destructive">*</span></Label>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingProjects}>
                        <SelectTrigger><SelectValue placeholder={loadingProjects ? "Loading projects..." : "Select project"} /></SelectTrigger>
                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {form.formState.errors.projectId && <p className="text-sm text-destructive mt-1">{form.formState.errors.projectId.message}</p>}
                    </div>
                  )} />
                  <Controller name="reportDate" control={form.control} render={({ field }) => (
                    <div>
                        <Label>Report Date <span className="text-destructive">*</span></Label>
                        <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={(date) => date > new Date()} /></PopoverContent></Popover>
                    </div>
                  )} />
                </div>
                 <div>
                    <Label>Progress Completion (%) <span className="text-destructive">*</span></Label>
                    <div className="flex items-center gap-4">
                      <Controller name="progressPercentage" control={form.control} render={({ field }) => (
                        <Slider value={[field.value]} onValueChange={(value) => field.onChange(value[0])} max={100} step={1} className="flex-grow"/>
                      )} />
                      <Badge variant="outline" className="w-16 justify-center">{form.watch('progressPercentage')}%</Badge>
                    </div>
                  </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Work Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Controller name="summary" control={form.control} render={({ field }) => (
                    <div>
                        <Label>Summary of Progress <span className="text-destructive">*</span></Label>
                        <Textarea {...field} placeholder="Summarize the work completed today..." className="min-h-[100px]"/>
                        {form.formState.errors.summary && <p className="text-sm text-destructive mt-1">{form.formState.errors.summary.message}</p>}
                    </div>
                 )} />
                <Controller name="notes" control={form.control} render={({ field }) => (
                    <div>
                        <Label>General Notes (Optional)</Label>
                        <Textarea {...field} placeholder="Any other remarks or observations..." className="min-h-[80px]"/>
                    </div>
                 )} />
                 <Controller name="issuesOrDelays" control={form.control} render={({ field }) => (
                    <div>
                        <Label>Issues or Delays Encountered (Optional)</Label>
                        <Textarea {...field} placeholder="e.g., Material shortage, unexpected site issue..." className="min-h-[80px]"/>
                    </div>
                 )} />
                 <Controller name="siteConditions" control={form.control} render={({ field }) => (
                    <div>
                        <Label>Site & Weather Conditions (Optional)</Label>
                        <Input {...field} placeholder="e.g., Sunny, 32°C. Site dry."/>
                    </div>
                 )} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus/> Media Upload</CardTitle><CardDescription>Add up to 5 photos as evidence.</CardDescription></CardHeader>
              <CardContent>
                <Input id="media" type="file" multiple accept="image/*,video/mp4" onChange={handleMediaChange} disabled={mediaFiles.length >= 5} />
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {mediaPreviews.map((src, index) => (
                    <div key={index} className="relative">
                      <Image src={src} alt={`Preview ${index}`} width={150} height={100} className="rounded-md object-cover w-full h-24" data-ai-hint="site photo" />
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => removeMedia(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                 <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isSubmitting}>
                  {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                  {isSubmitting ? "Submitting Report..." : "Submit DPR"}
                 </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
