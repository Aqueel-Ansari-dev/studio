
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

const formSchema = z.object({
  companyName: z.string().min(1, { message: 'Company name is required.' }),
  companyLogoUrl: z.string().url().optional().or(z.literal('')),
});

type SystemSettingsFormValues = z.infer<typeof formSchema>;

interface SystemSettingsFormProps {
  initialSettings: SystemSettingsFormValues | null;
}

export function SystemSettingsForm({ initialSettings }: SystemSettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(initialSettings?.companyLogoUrl || null);

  const form = useForm<SystemSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialSettings || {
      companyName: '',
      companyLogoUrl: '',
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
    setLoading(true);
    let newLogoUrl = values.companyLogoUrl;

    try {
      if (logoFile) {
        const storageRef = ref(storage, `company-logos/${logoFile.name}`);
        const snapshot = await uploadBytes(storageRef, logoFile);
        newLogoUrl = await getDownloadURL(snapshot.ref);
      }

      const result = await setSystemSettings(values.companyName, newLogoUrl);

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
                />
                <Button
                  variant="ghost"
                  size="sm"
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
