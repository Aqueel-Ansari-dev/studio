
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowLeft, Send, XOctagon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchInvitesForAdmin, type InviteForList } from '@/app/actions/invites/fetchInvites';
import { format, isPast } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ViewInvitesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<InviteForList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInvites = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const result = await fetchInvitesForAdmin(user.id);
    if (result.success && result.invites) {
      setInvites(result.invites);
    } else {
      toast({ title: "Error", description: result.error || "Could not load invitations.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [user?.id, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      loadInvites();
    }
  }, [authLoading, user, loadInvites]);

  const getStatusBadge = (invite: InviteForList) => {
    if (isPast(new Date(invite.expiresAt)) && invite.status === 'pending') {
        return <Badge variant="destructive">Expired</Badge>;
    }
    switch (invite.status) {
        case 'pending': return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
        case 'accepted': return <Badge className="bg-green-500 text-white">Accepted</Badge>;
        default: return <Badge variant="secondary">{invite.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sent Invitations"
        description="View the status of all user invitations for your organization."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/user-management">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to User List
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle className="font-headline">Invitation Log</CardTitle>
                <CardDescription>
                {isLoading ? "Loading invites..." : `Showing ${invites.length} invitation(s).`}
                </CardDescription>
            </div>
            <Button onClick={loadInvites} variant="outline" size="icon" disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin" /></div>
          ) : invites.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No invitations have been sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map(invite => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                        <Badge variant="secondary">{invite.role}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(invite)}</TableCell>
                    <TableCell>{format(new Date(invite.expiresAt), "PPpp")}</TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" disabled>
                            <Send className="mr-2 h-4 w-4" /> Resend
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled>
                            <XOctagon className="mr-2 h-4 w-4" /> Revoke
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
