
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { setSystemSettings } from '@/app/actions/admin/systemSettings';
import Image from 'next/image';
import { uploadBytes, ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { Briefcase, AtSign, KeyRound, EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  companyName: z.string().min(1, { message: 'Company name is required.' }),
  customHeaderTitle: z.string().optional(),
  companyLogoUrl: z.string().url().optional().or(z.literal('')),
  paidLeaves: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseInt(val.replace(/[^0-9]/g, ''), 10) : val),
    z.number().min(0, "Paid leaves cannot be negative.").optional().default(0)
  ),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Must be a valid hex color code.' }).optional(),
});

type SystemSettingsFormValues = z.infer<typeof formSchema>;

interface SystemSettingsFormProps {
  initialSettings: SystemSettingsFormValues | null;
}

const defaultBranding: SystemSettingsFormValues = {
    companyName: 'FieldOps',
    customHeaderTitle: '',
    companyLogoUrl: '',
    paidLeaves: 14,
    primaryColor: '#6B8ECA', // Default primary color from theme
};


export function SystemSettingsForm({ initialSettings }: SystemSettingsFormProps) {
  const { user, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const form = useForm<SystemSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialSettings || defaultBranding,
  });
  
  const watchedValues = form.watch();

  useEffect(() => {
    if (initialSettings) {
      form.reset(initialSettings);
    }
  }, [initialSettings, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast({ title: 'Invalid File Type', description: 'Please upload a PNG, JPG, WEBP or SVG file.', variant: 'destructive' });
        return;
      }
      if (file.size > 1 * 1024 * 1024) { // 1MB limit
        toast({ title: "Image Too Large", description: "Please select an image smaller than 1MB.", variant: "destructive"});
        event.target.value = ''; // Reset the input
        return;
      }
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      form.setValue('companyLogoUrl', previewUrl, { shouldDirty: true });
    }
  };

  const handleReset = async () => {
      if (!user) return;
      setLoading(true);
      try {
          const result = await setSystemSettings(user.id, {
              companyName: "FieldOps", // Reset to default name
              companyLogoUrl: null,
              primaryColor: null,
              customHeaderTitle: null
          });
          if (result.success) {
              toast({ title: 'Branding Reset', description: 'Your branding has been reset to the defaults.' });
              form.reset(defaultBranding);
              updateUserProfileInContext({ branding: { companyName: "FieldOps", companyLogoUrl: null, primaryColor: null, customHeaderTitle: null }});
          } else {
              toast({ title: 'Error', description: result.message, variant: 'destructive' });
          }
      } catch (error) {
           toast({ title: 'Error', description: 'Could not reset branding settings.', variant: 'destructive' });
      } finally {
          setLoading(false);
      }
  };

  const onSubmit = async (values: SystemSettingsFormValues) => {
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in to update settings.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    let newLogoUrl = values.companyLogoUrl;

    try {
      if (logoFile && user.organizationId) {
        const storageRef = ref(storage, `organizations/${user.organizationId}/logos/company-logo`);
        const snapshot = await uploadBytes(storageRef, logoFile);
        newLogoUrl = await getDownloadURL(snapshot.ref);
      }

      const settingsToSave = {
          companyName: values.companyName,
          paidLeaves: values.paidLeaves,
          companyLogoUrl: newLogoUrl,
          primaryColor: values.primaryColor,
          customHeaderTitle: values.customHeaderTitle
      };
      
      const result = await setSystemSettings(user.id, settingsToSave);

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        updateUserProfileInContext({ branding: settingsToSave }); // Update context immediately
        form.reset(values); // Reset form to new saved state
        setLogoFile(null); // Clear staged file
      } else {
        toast({ title: 'Error', description: result.message || 'Failed to update settings.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <CardHeader>
            <CardTitle>Organization Branding</CardTitle>
            <CardDescription>Manage your company name, logo, and branding colors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" {...form.register('companyName')} disabled={loading} />
              {form.formState.errors.companyName && <p className="text-destructive text-sm mt-1">{form.formState.errors.companyName.message}</p>}
            </div>

            <div>
              <Label htmlFor="customHeaderTitle">Custom Header Title (Optional)</Label>
              <Input id="customHeaderTitle" {...form.register('customHeaderTitle')} placeholder="e.g., Acme Corp Ops" disabled={loading} />
               <p className="text-xs text-muted-foreground pt-1">If blank, Company Name is used.</p>
            </div>

             <div>
                <Label htmlFor="primaryColor">Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                    <Input id="primaryColor" type="color" {...form.register('primaryColor')} className="w-14 p-1"/>
                    <Input {...form.register('primaryColor')} placeholder="#6B8ECA" className="w-32"/>
                </div>
                 {form.formState.errors.primaryColor && <p className="text-destructive text-sm mt-1">{form.formState.errors.primaryColor.message}</p>}
            </div>

            <div>
              <Label htmlFor="companyLogo">Company Logo</Label>
              <Input id="companyLogo" type="file" accept="image/png, image/jpeg, image/svg+xml, image/webp" onChange={handleFileChange} disabled={loading} />
            </div>

            <div className="pt-4">
              <Label htmlFor="paidLeaves">Annual Paid Leaves</Label>
              <Input id="paidLeaves" type="number" {...form.register('paidLeaves')} disabled={loading} placeholder="e.g., 14" />
              {form.formState.errors.paidLeaves && <p className="text-destructive text-sm mt-1">{form.formState.errors.paidLeaves.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="submit" disabled={loading || !form.formState.isDirty}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" type="button" disabled={loading}>Reset to Defaults</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will reset your company name, logo, and colors to the FieldOps defaults. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReset} className="bg-destructive hover:bg-destructive/90">Reset Branding</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </form>
      </Card>

      <div className="lg:col-span-1 space-y-4">
        <Card>
            <CardHeader><CardTitle className="text-base">Dashboard Preview</CardTitle></CardHeader>
            <CardContent>
                <div className="w-full h-28 bg-muted rounded-lg flex items-center justify-center p-4">
                    <div className="w-full bg-background rounded-md shadow-lg overflow-hidden">
                        <header className="flex h-10 items-center gap-2 border-b px-3">
                             {watchedValues.companyLogoUrl ? (
                                <Image src={watchedValues.companyLogoUrl} alt="Logo Preview" width={20} height={20} className="h-5 w-5 object-contain" data-ai-hint="logo" unoptimized/>
                              ) : (
                                <Briefcase className="h-5 w-5" style={{ color: watchedValues.primaryColor }} />
                              )}
                              <span className="font-semibold text-sm truncate" style={{ color: watchedValues.primaryColor }}>
                                {watchedValues.customHeaderTitle || watchedValues.companyName || 'Header Title'}
                              </span>
                        </header>
                        <div className="p-3 text-xs text-muted-foreground">
                            <p>Content area...</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
         <Card>
            <CardHeader><CardTitle className="text-base">Login Page Preview</CardTitle></CardHeader>
            <CardContent>
                <div className="w-full bg-muted rounded-lg flex items-center justify-center p-4">
                    <div className="w-full max-w-xs bg-card rounded-lg shadow-lg overflow-hidden scale-90">
                        <div className="text-center p-4 bg-muted/50">
                             {watchedValues.companyLogoUrl ? (
                                <Image src={watchedValues.companyLogoUrl} alt="Logo Preview" width={80} height={40} className="mx-auto h-10 w-auto object-contain" data-ai-hint="logo" unoptimized/>
                             ) : (
                                <Briefcase className="h-8 w-8 mx-auto" style={{ color: watchedValues.primaryColor }}/>
                             )}
                              <h3 className="text-lg font-semibold mt-2" style={{ color: watchedValues.primaryColor }}>
                                {watchedValues.companyName || 'FieldOps'}
                              </h3>
                        </div>
                         <div className="p-4 space-y-2">
                             <div className="relative"><AtSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="pl-8 h-8 text-xs" disabled placeholder="you@company.com" /></div>
                             <div className="relative"><KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="pl-8 h-8 text-xs" disabled type="password" placeholder="••••••••" /></div>
                             <Button className="w-full h-9 mt-2" style={{ backgroundColor: watchedValues.primaryColor }}>Login</Button>
                         </div>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
