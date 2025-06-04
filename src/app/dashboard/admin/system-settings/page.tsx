
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export default function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="System Settings" 
        description="Configure global application parameters."
        actions={
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">General Settings</CardTitle>
          <CardDescription>Application name, default timezone, etc. (Placeholder)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Forms for various system settings (e.g., GPS verification radius, notification preferences, API keys) will be implemented here.
          </p>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle className="font-headline">Compliance Settings</CardTitle>
          <CardDescription>Parameters for AI compliance checks. (Placeholder)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Settings related to compliance rules, thresholds, and AI model configurations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
