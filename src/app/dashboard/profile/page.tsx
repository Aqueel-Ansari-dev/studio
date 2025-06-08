"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Phone } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile, UpdateUserProfileInput, UpdateUserProfileResult } from '@/app/actions/user/updateUserProfile';

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.phoneNumber || '');
      setOptIn(!!user.whatsappOptIn);
    }
  }, [user]);

  if (!user) {
    return <div className="p-4">Loading...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const input: UpdateUserProfileInput = { phoneNumber, whatsappOptIn: optIn };
    const result: UpdateUserProfileResult = await updateUserProfile(user.id, input);
    if (result.success) {
      toast({ title: "Profile Updated", description: result.message });
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Update your contact details" />
      <Card className="max-w-md shadow">
        <CardHeader>
          <CardTitle className="font-headline text-xl">WhatsApp Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (for WhatsApp)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  className="pl-10"
                  placeholder="e.g., +15551234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="optIn" checked={optIn} onCheckedChange={setOptIn} />
              <Label htmlFor="optIn">Enable WhatsApp Notifications</Label>
            </div>
            <Button type="submit" disabled={isSubmitting}>Update Profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
