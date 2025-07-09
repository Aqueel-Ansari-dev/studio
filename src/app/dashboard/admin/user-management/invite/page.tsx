
"use client";

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, UserPlus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { sendInvite } from '@/app/actions/admin/sendInvite';
import type { UserRole } from '@/types/database';

const inviteFormSchema = z.object({
  displayName: z.string().min(2, 'Display name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['employee', 'supervisor', 'admin'], {
    required_error: 'You must select a role.',
  }),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

export default function InviteUserPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState('');

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      role: 'employee',
    },
  });

  const onSubmit = async (data: InviteFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    setLastInviteLink('');

    const result = await sendInvite(user.id, data);

    if (result.success) {
      toast({
        title: "Invite Sent!",
        description: result.message,
      });
      if (result.inviteLink) {
        setLastInviteLink(result.inviteLink);
      }
      form.reset();
    } else {
      toast({
        title: "Failed to Send Invite",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invite New User"
        description="Invite new employees, supervisors, or admins to your organization."
      />

      <Card>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2">
              <UserPlus />
              New User Invitation
            </CardTitle>
            <CardDescription>
              The new user will receive an email with a link to create their account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="displayName">Full Name</Label>
              <Input id="displayName" {...form.register('displayName')} />
              {form.formState.errors.displayName && <p className="text-sm text-destructive mt-1">{form.formState.errors.displayName.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.role && <p className="text-sm text-destructive mt-1">{form.formState.errors.role.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-4">
            <Button type="submit" disabled={isSubmitting || authLoading}>
              {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Invitation
            </Button>
            {lastInviteLink && (
              <div className="text-sm text-muted-foreground p-3 border-dashed border rounded-lg w-full">
                <p>For testing purposes, here is the invite link:</p>
                <Input
                  readOnly
                  value={lastInviteLink}
                  className="mt-2 text-xs bg-muted"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
