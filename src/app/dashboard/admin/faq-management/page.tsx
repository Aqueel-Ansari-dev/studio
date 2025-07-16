
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { addFaq, updateFaq, deleteFaq, fetchFaqs } from '@/app/actions/admin/manageFaqs';
import type { FAQ, UserRole } from '@/types/database';
import { PlusCircle, Edit, Trash2, RefreshCw, HelpCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const faqFormSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters.'),
  answer: z.string().min(10, 'Answer must be at least 10 characters.'),
  category: z.string().min(1, 'Category is required.'),
  targetRoles: z.array(z.string()).min(1, 'At least one target role is required.'),
});

type FaqFormValues = z.infer<typeof faqFormSchema>;
const roles: UserRole[] = ['employee', 'supervisor', 'admin'];

export default function FaqManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [deletingFaqId, setDeletingFaqId] = useState<string | null>(null);

  const form = useForm<FaqFormValues>({
    resolver: zodResolver(faqFormSchema),
    defaultValues: {
      question: '',
      answer: '',
      category: '',
      targetRoles: ['employee'],
    },
  });

  const loadFaqs = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const result = await fetchFaqs(user.id);
    if (result.success && result.faqs) {
      setFaqs(result.faqs);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setIsLoading(false);
  }, [user, toast]);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const onSubmit = async (data: FaqFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    const result = editingFaq
      ? await updateFaq(user.id, editingFaq.id, data)
      : await addFaq(user.id, data);

    if (result.success) {
      toast({ title: `FAQ ${editingFaq ? 'updated' : 'added'}`, description: result.message });
      form.reset({ question: '', answer: '', category: '', targetRoles: ['employee'] });
      setEditingFaq(null);
      await loadFaqs();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };
  
  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    form.reset({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      targetRoles: faq.targetRoles,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEdit = () => {
    setEditingFaq(null);
    form.reset({ question: '', answer: '', category: '', targetRoles: ['employee'] });
  };
  
  const handleDelete = async () => {
    if (!deletingFaqId || !user) return;
    const result = await deleteFaq(user.id, deletingFaqId);
    if (result.success) {
      toast({ title: 'FAQ Deleted', description: result.message });
      await loadFaqs();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setDeletingFaqId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="FAQ Management" description="Create and manage your organization's knowledge base." />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle className="font-headline">{editingFaq ? 'Edit FAQ' : 'Add New FAQ'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="question">Question</Label>
                  <Input id="question" {...form.register('question')} />
                  {form.formState.errors.question && <p className="text-sm text-destructive">{form.formState.errors.question.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="answer">Answer</Label>
                  <Textarea id="answer" {...form.register('answer')} className="min-h-[120px]" />
                  {form.formState.errors.answer && <p className="text-sm text-destructive">{form.formState.errors.answer.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" {...form.register('category')} placeholder="e.g., Leave Policy" />
                  {form.formState.errors.category && <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>}
                </div>
                <div>
                  <Label>Visible to Roles</Label>
                  <div className="space-y-2 mt-2">
                    {roles.map(role => (
                      <Controller
                        key={role}
                        name="targetRoles"
                        control={form.control}
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={role}
                              checked={field.value?.includes(role)}
                              onCheckedChange={checked => {
                                return checked
                                  ? field.onChange([...(field.value || []), role])
                                  : field.onChange(field.value?.filter(v => v !== role));
                              }}
                            />
                            <label htmlFor={role} className="text-sm font-medium capitalize">{role}</label>
                          </div>
                        )}
                      />
                    ))}
                    {form.formState.errors.targetRoles && <p className="text-sm text-destructive">{form.formState.errors.targetRoles.message}</p>}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button type="submit" disabled={isSubmitting}>
                   {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                   {editingFaq ? 'Update FAQ' : 'Add FAQ'}
                </Button>
                {editingFaq && <Button variant="ghost" onClick={handleCancelEdit}>Cancel Edit</Button>}
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><HelpCircle className="mr-2"/>FAQ Library</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${faqs.length} FAQs found.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin mx-auto" /></div>
              ) : faqs.length === 0 ? (
                <p className="text-muted-foreground text-center py-10">No FAQs found. Add one to get started.</p>
              ) : (
                <div className="space-y-2">
                  {faqs.map(faq => (
                    <div key={faq.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold flex-1">{faq.question}</h4>
                        <div className="flex items-center space-x-1">
                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(faq)}><Edit className="h-4 w-4"/></Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingFaqId(faq.id)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="secondary">{faq.category}</Badge>
                        <div className="text-xs text-muted-foreground">
                            Visible to: {faq.targetRoles.join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

       <AlertDialog open={!!deletingFaqId} onOpenChange={() => setDeletingFaqId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this FAQ. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
