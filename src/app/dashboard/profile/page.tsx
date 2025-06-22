
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Phone, Save, UserCircle, RefreshCw, Mail } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile, UpdateUserProfileResult } from '@/app/actions/user/updateUserProfile';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: 'Display name must be at least 2 characters.' }).max(50),
  phoneNumber: z
    .string()
    .regex(/^\+\d{10,15}$/, { message: 'Invalid phone number format. Use + followed by country code and number (e.g., +15551234567).' })
    .optional()
    .or(z.literal('')),
  whatsappOptIn: z.boolean().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user, updateUserProfileInContext, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      phoneNumber: '',
      whatsappOptIn: false,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        phoneNumber: user.phoneNumber || '',
        whatsappOptIn: !!user.whatsappOptIn,
      });
    }
  }, [user, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive"});
        return;
    }
    
    const result: UpdateUserProfileResult = await updateUserProfile(user.id, data);
    
    if (result.success) {
      toast({ title: "Profile Updated", description: result.message });
      if (result.updatedUser) {
        updateUserProfileInContext(result.updatedUser);
      }
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
  };
  
  if (authLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <div className="p-4"><PageHeader title="Access Denied" description="Please log in to view your profile."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Update your personal details and notification preferences." />
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Personal Information</CardTitle>
                    <CardDescription>This is how your name will be displayed in the app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your display name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                        <Label>Email Address (Read-only)</Label>
                        <Input value={user.email} readOnly disabled className="bg-muted/50"/>
                    </div>
                    <div className="space-y-2">
                        <Label>Role (Read-only)</Label>
                        <Input value={user.role.charAt(0).toUpperCase() + user.role.slice(1)} readOnly disabled className="bg-muted/50"/>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Notification Settings</CardTitle>
                    <CardDescription>Manage your WhatsApp notification preferences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+15551234567" {...field} />
                          </FormControl>
                          <FormDescription>
                             Enter in international format. Leave blank to remove.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="whatsappOptIn"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Enable WhatsApp Notifications
                            </FormLabel>
                            <FormDescription>
                              Receive task assignments and updates via WhatsApp.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!form.watch("phoneNumber")}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                </CardContent>
            </Card>
            
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
              Save All Changes
            </Button>
        </form>
      </Form>
    </div>
  );
}
