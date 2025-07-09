
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { SystemSettingsForm } from '@/components/admin/SystemSettingsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { getSystemSettings } from "@/app/actions/admin/systemSettings";
import { useAuth } from "@/context/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const [initialSettings, setInitialSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      if (!user?.id) return;
      setIsLoading(true);
      const { settings, success } = await getSystemSettings(user.id);
      if (success && settings) {
        setInitialSettings({
          companyName: settings.companyName || '',
          companyLogoUrl: settings.companyLogoUrl || '',
          paidLeaves: settings.paidLeaves || 0,
          primaryColor: settings.primaryColor || '#000000',
          customHeaderTitle: settings.customHeaderTitle || ''
        });
      } else {
        // Handle error or no settings case
        setInitialSettings({
          companyName: 'My Company',
          companyLogoUrl: '',
          paidLeaves: 0,
          primaryColor: '#000000',
          customHeaderTitle: 'FieldOps'
        });
      }
      setIsLoading(false);
    }
    fetchSettings();
  }, [user?.id]);


  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure global application parameters for your organization."
      />
      
      {isLoading || !initialSettings ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : (
        <SystemSettingsForm initialSettings={initialSettings} />
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Environment Variables</CardTitle>
          <CardDescription>
            View client-exposed variables. (Read-only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Environment variables are set at deploy time and are not editable here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
