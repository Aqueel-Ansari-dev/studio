
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Phone, Save, UserCircle, RefreshCw } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile, UpdateUserProfileInput, UpdateUserProfileResult } from '@/app/actions/user/updateUserProfile';

export default function ProfilePage() {
  const { user, updateUserProfileInContext, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.phoneNumber || '');
      setOptIn(!!user.whatsappOptIn);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    setErrors({});
    const input: UpdateUserProfileInput = { 
        phoneNumber: phoneNumber.trim() === '' ? '' : phoneNumber, // Send empty string if cleared
        whatsappOptIn: optIn 
    };
    const result: UpdateUserProfileResult = await updateUserProfile(user.id, input);
    if (result.success) {
      toast({ title: "Profile Updated", description: result.message });
      if (result.updatedUser) {
        updateUserProfileInContext(result.updatedUser);
      }
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
      if(result.errors) {
        const newErrors: Record<string, string> = {};
        result.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      }
    }
    setIsSubmitting(false);
  };
  
  if (authLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <div className="p-4"><PageHeader title="Access Denied" description="Please log in to view your profile."/></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Update your contact details and notification preferences." />
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="font-headline text-xl">User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
                <UserCircle className="w-6 h-6 text-muted-foreground"/>
                <div>
                    <p className="text-sm font-medium">Display Name</p>
                    <p className="text-sm text-muted-foreground">{user.displayName || "Not set"}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                 <UserCircle className="w-6 h-6 text-muted-foreground opacity-0"/> {/* Placeholder for alignment */}
                <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
            </div>
             <div className="flex items-center gap-3">
                 <UserCircle className="w-6 h-6 text-muted-foreground opacity-0"/>
                <div>
                    <p className="text-sm font-medium">Role</p>
                    <p className="text-sm text-muted-foreground">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Notification Settings</CardTitle>
            <CardDescription>Manage your WhatsApp notification preferences.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    className="pl-10"
                    placeholder="e.g., +15551234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    aria-describedby="phone-error"
                  />
                </div>
                {errors.phoneNumber && <p id="phone-error" className="text-sm text-destructive mt-1">{errors.phoneNumber}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                    Enter in international format (e.g., +15551234567 for US). Leave blank to remove.
                </p>
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <Switch id="optIn" checked={optIn} onCheckedChange={setOptIn} disabled={!phoneNumber.trim()} />
                <Label htmlFor="optIn" className="cursor-pointer">
                    Enable WhatsApp Notifications
                    {!phoneNumber.trim() && <span className="text-xs text-muted-foreground ml-1">(requires phone number)</span>}
                </Label>
              </div>
              <Button type="submit" disabled={isSubmitting || authLoading} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <Save className="mr-2 h-4 w-4" /> 
                {isSubmitting ? "Saving..." : "Save Preferences"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
