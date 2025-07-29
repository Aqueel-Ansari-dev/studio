

"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Save, UserCircle, RefreshCw, Mail, UploadCloud, Building } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile, UpdateUserProfileResult } from '@/app/actions/user/updateUserProfile';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: 'Display name must be at least 2 characters.' }).max(50),
  phoneNumber: z
    .string()
    .regex(/^\+\d{10,15}$/, { message: 'Phone number is required in international format (e.g., +919876543210).' }),
  whatsappOptIn: z.boolean().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user, updateUserProfileInContext, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarDataUri, setAvatarDataUri] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setAvatarPreview(user.photoURL || null);
      
      const fetchOrgName = async () => {
          if(user.organizationId) {
              setLoadingOrg(true);
              const orgDocRef = doc(db, 'organizations', user.organizationId);
              const orgDocSnap = await getDoc(orgDocRef);
              if (orgDocSnap.exists()) {
                  setOrganizationName(orgDocSnap.data().name || 'Unnamed Organization');
              } else {
                  setOrganizationName('Organization Not Found');
              }
              setLoadingOrg(false);
          }
      }
      fetchOrgName();
    }
  }, [user, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit
        toast({ title: "Image Too Large", description: "Please select an image smaller than 1MB.", variant: "destructive"});
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setAvatarDataUri(dataUri);
        setAvatarPreview(dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive"});
        return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result: UpdateUserProfileResult = await updateUserProfile(user.id, {
          displayName: data.displayName,
          phoneNumber: data.phoneNumber,
          whatsappOptIn: data.whatsappOptIn,
          avatarDataUri: avatarDataUri || undefined,
      });
      
      if (result.success) {
        toast({ title: "Profile Updated", description: result.message });
        if (result.updatedUser) {
          updateUserProfileInContext(result.updatedUser);
        }
        form.reset(form.getValues());
        setAvatarDataUri(null);
      } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
       toast({ title: "Update Failed", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (authLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <div className="p-4"><PageHeader title="Access Denied" description="Please log in to view your profile."/></div>;
  }
  
  const hasChanges = form.formState.isDirty || !!avatarDataUri;

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Update your personal details and notification preferences." />
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Personal Information</CardTitle>
                    <CardDescription>This is how your name and avatar will be displayed in the app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-24 w-24 border">
                            <AvatarImage src={avatarPreview || ''} alt={user.displayName || ''} data-ai-hint="user avatar" />
                            <AvatarFallback className="text-3xl">{user.displayName?.substring(0, 2).toUpperCase() || user.email.substring(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                            <Label htmlFor="avatarFile">Change Profile Picture</Label>
                            <Input id="avatarFile" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                            <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP. Max 1MB.</p>
                        </div>
                    </div>
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
                        <Label>Organization</Label>
                        <Input value={loadingOrg ? 'Loading...' : organizationName} readOnly disabled className="bg-muted/50"/>
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
                            <Input placeholder="+919876543210" {...field} />
                          </FormControl>
                          <FormDescription>
                             Enter in international format. This field is required.
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
            
            <Button type="submit" disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
              {isSubmitting ? 'Saving...' : 'Save All Changes'}
            </Button>
        </form>
      </Form>
    </div>
  );
}
