"use client";

import { PageHeader } from "@/components/shared/page-header";
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function SystemSettingsPage() {
  const initialEnv = {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };

  const [envValues, setEnvValues] = useState(initialEnv);
  const { toast } = useToast();

  const handleChange = (key: string, value: string) => {
    setEnvValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast({
      title: "Environment variables updated",
      description:
        "Changes are stored locally in this demo and will not persist",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure global application parameters."
        actions={
          <Button
            onClick={handleSave}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">General Settings</CardTitle>
          <CardDescription>
            Application name, default timezone, etc. (Placeholder)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Forms for various system settings (e.g., GPS verification radius,
            notification preferences, API keys) will be implemented here.
          </p>
        </CardContent>
      </Card>
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
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Environment Variables</CardTitle>
          <CardDescription>
            View and modify client-exposed variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(envValues).map(([key, value]) => (
            <div key={key}>
              <Label htmlFor={key}>{key}</Label>
              <Input
                id={key}
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="mt-1"
              />
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            Updates here are for demonstration and will not persist after
            refresh. Production changes require redeploying with new .env
            values.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
