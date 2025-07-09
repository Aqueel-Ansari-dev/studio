
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
import { setSystemSettings } from '@/app/actions/admin/systemSettings';
import Image from 'next/image';
import { uploadBytes, ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { Briefcase } from 'lucide-react';

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

export function SystemSettingsForm({ initialSettings }: SystemSettingsFormProps) {
  const { user, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const form = useForm<SystemSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialSettings || {},
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
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      form.setValue('companyLogoUrl', previewUrl, { shouldDirty: true });
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
              <Input id="companyLogo" type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileChange} disabled={loading} />
            </div>

            <div className="pt-4">
              <Label htmlFor="paidLeaves">Annual Paid Leaves</Label>
              <Input id="paidLeaves" type="number" {...form.register('paidLeaves')} disabled={loading} placeholder="e.g., 14" />
              {form.formState.errors.paidLeaves && <p className="text-destructive text-sm mt-1">{form.formState.errors.paidLeaves.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading || !form.formState.isDirty}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="lg:col-span-1">
        <Card>
            <CardHeader><CardTitle>Live Preview</CardTitle></CardHeader>
            <CardContent>
                <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center p-4">
                    <div className="w-full bg-background rounded-md shadow-lg overflow-hidden">
                        <header className="flex h-10 items-center gap-2 border-b px-3">
                             {watchedValues.companyLogoUrl ? (
                                <Image src={watchedValues.companyLogoUrl} alt="Logo Preview" width={20} height={20} className="h-5 w-5 object-contain" data-ai-hint="logo"/>
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
      </div>
    </div>
  );
}
