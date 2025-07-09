
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
import { getSystemSettings, setSystemSettings } from '@/app/actions/admin/systemSettings';
import Image from 'next/image';
import { uploadBytes, ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';

const formSchema = z.object({
  companyName: z.string().min(1, { message: 'Company name is required.' }),
  companyLogoUrl: z.string().url().optional().or(z.literal('')),
  paidLeaves: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseInt(val.replace(/[^0-9]/g, ''), 10) : val),
    z.number().min(0, "Paid leaves cannot be negative.").optional().default(0)
  ),
});

type SystemSettingsFormValues = z.infer<typeof formSchema>;

interface SystemSettingsFormProps {
  initialSettings: SystemSettingsFormValues | null;
}

export function SystemSettingsForm({ initialSettings }: SystemSettingsFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(initialSettings?.companyLogoUrl || null);

  const form = useForm<SystemSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialSettings || {
      companyName: '',
      companyLogoUrl: '',
      paidLeaves: 0,
    },
  });

  useEffect(() => {
    if (initialSettings) {
      form.reset(initialSettings);
      setPreviewLogoUrl(initialSettings.companyLogoUrl || null);
    }
  }, [initialSettings, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setLogoFile(file);
      setPreviewLogoUrl(URL.createObjectURL(file)); // Create a preview URL
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

      const result = await setSystemSettings(user.id, values.companyName, values.paidLeaves ?? 0, newLogoUrl);

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to update settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while saving settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <CardDescription>Manage company-wide settings like name and logo.</CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              {...form.register('companyName')}
              disabled={loading}
            />
            {form.formState.errors.companyName && (
              <p className="text-red-500 text-sm">{form.formState.errors.companyName.message}</p>
            )}
          </div>
          
          <div className="pt-4">
            <Label htmlFor="paidLeaves">Annual Paid Leaves</Label>
            <Input
              id="paidLeaves"
              type="number"
              {...form.register('paidLeaves')}
              disabled={loading}
              placeholder="e.g., 14"
            />
             {form.formState.errors.paidLeaves && (
              <p className="text-red-500 text-sm">{form.formState.errors.paidLeaves.message}</p>
            )}
            <p className="text-xs text-muted-foreground pt-1">Set the number of paid leaves available to employees annually.</p>
          </div>

          <div>
            <Label htmlFor="companyLogo">Company Logo</Label>
            <Input
              id="companyLogo"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
            />
            {form.formState.errors.companyLogoUrl && (
              <p className="text-red-500 text-sm">{form.formState.errors.companyLogoUrl.message}</p>
            )}
            {previewLogoUrl && (
              <div className="mt-2">
                <p className="text-sm text-gray-500 mb-1">Current/New Logo:</p>
                <Image 
                  src={previewLogoUrl}
                  alt="Company Logo"
                  width={100}
                  height={100}
                  className="object-contain"
                  data-ai-hint="company logo"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setPreviewLogoUrl(null);
                    setLogoFile(null);
                    form.setValue('companyLogoUrl', '');
                  }}
                  className="text-red-500 mt-2"
                >
                  Remove Logo
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
