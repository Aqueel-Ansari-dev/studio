
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { getSystemConfig } from "@/app/actions/admin/getSystemConfig";
import { updateSystemConfig } from "@/app/actions/admin/updateSystemConfig";
import { useToast } from "@/hooks/use-toast";

export default function SystemSettingsPage() {
  const [mapboxKey, setMapboxKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getSystemConfig();
      if (result.success && result.config) {
        setMapboxKey(result.config.mapboxApiKey || "");
        setOpenAiKey(result.config.openAiApiKey || "");
      } else if (!result.success) {
        toast({ title: "Error", description: result.error || "Could not load config.", variant: "destructive" });
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  const handleSave = async () => {
    const result = await updateSystemConfig({ mapboxApiKey: mapboxKey, openAiApiKey: openAiKey });
    if (result.success) {
      toast({ title: "Config Saved", description: result.message });
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure global application parameters."
        actions={
          <Button onClick={handleSave} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">API Keys</CardTitle>
          <CardDescription>Manage third-party service keys used by the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="mapbox">Mapbox API Key</Label>
            <Input id="mapbox" value={mapboxKey} onChange={(e) => setMapboxKey(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="openai">OpenAI API Key</Label>
            <Input id="openai" value={openAiKey} onChange={(e) => setOpenAiKey(e.target.value)} disabled={loading} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
