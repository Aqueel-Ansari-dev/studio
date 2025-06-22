
import { PageHeader } from "@/components/shared/page-header";
import { getSystemSettings } from '@/app/actions/admin/systemSettings';
import { SystemSettingsForm } from '@/components/admin/SystemSettingsForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

export default async function SystemSettingsPage() {
  const { settings: initialSettings, success } = await getSystemSettings();

  // Handle cases where fetching settings failed or no settings exist yet
  const formInitialValues = success && initialSettings ? {
    companyName: initialSettings.companyName,
    companyLogoUrl: initialSettings.companyLogoUrl || '',
    paidLeaves: initialSettings.paidLeaves || 0,
  } : {
    companyName: '',
    companyLogoUrl: '',
    paidLeaves: 0,
  };

  // Environment variables section (keep as client-side for demo purposes, if it's meant to be dynamic client-side input)
  // This part needs to be a client component or passed as props if it's to be edited.
  // For now, I'll move it to a separate client component if it needs interactive editing.
  // Given the current structure, it's simpler to keep the page as a server component
  // and only include the SystemSettingsForm which is a client component.

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure global application parameters."
        // actions can be placed inside the form or handled differently if needed.
      />
      
      <SystemSettingsForm initialSettings={formInitialValues} />

      {/* Placeholder for other settings, can be replaced by more specific forms later */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Compliance Settings</CardTitle>
          <CardDescription>
            Parameters for AI compliance checks. (Placeholder)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Settings related to compliance rules, thresholds, and AI model
            configurations.
          </p>
        </CardContent>
      </Card>
      
      {/* If Environment Variables need to be editable on client, they should be in a separate Client Component */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Environment Variables</CardTitle>
          <CardDescription>
            View client-exposed variables. (Not editable here in server component)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Environment variables are typically set at deploy time and are not dynamically editable in the deployed application.
            Values displayed here reflect the build-time configuration.
          </p>
          {/* Display logic for env variables if needed, perhaps read directly from process.env if on server */}
        </CardContent>
      </Card>
    </div>
  );
}
