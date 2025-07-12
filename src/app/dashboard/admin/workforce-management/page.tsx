
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RefreshCw, Users, ShieldAlert, ArrowRight } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchUsersWithTaskCounts, type UserWithTaskCount } from '@/app/actions/common/fetchUsersWithTaskCounts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function WorkforceManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [usersWithWorkload, setUsersWithWorkload] = useState<UserWithTaskCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkforceData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const result = await fetchUsersWithTaskCounts(user.id, ['employee', 'supervisor']);
      if (result.success && result.users) {
        setUsersWithWorkload(result.users);
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to load workforce data.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user && !authLoading) {
      loadWorkforceData();
    }
  }, [user, authLoading, loadWorkforceData]);

  const getWorkloadBadge = (count: number) => {
    if (count <= 2) return <Badge variant="secondary" className="bg-green-100 text-green-800">Light</Badge>;
    if (count <= 5) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Moderate</Badge>;
    return <Badge variant="destructive">Heavy</Badge>;
  };

  const pageActions = (
    <Button onClick={loadWorkforceData} variant="outline" disabled={isLoading}>
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
    </Button>
  );

  if (authLoading || (!user && isLoading)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Workforce Management" description="Loading workforce data..." actions={pageActions} />
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return (
        <div className="p-4">
            <PageHeader title="Access Denied" description="Only administrators can access this page."/>
            <Card className="mt-4">
                <CardContent className="p-6 text-center">
                    <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
                    <p className="mt-2 font-semibold">Access Restricted</p>
                     <Button asChild variant="outline" className="mt-4">
                        <Link href="/dashboard">Go to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce Management"
        description="Monitor team workload and allocation across all projects."
        actions={pageActions}
      />
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Users className="mr-2"/> Team Workload</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading user data...' : `Showing workload for ${usersWithWorkload.length} users.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active Tasks</TableHead>
                <TableHead>Workload</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell><Skeleton className="h-6 w-32"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-16"/></TableCell>
                    <TableCell><Skeleton className="h-6 w-24"/></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto"/></TableCell>
                  </TableRow>
                ))
              ) : usersWithWorkload.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                usersWithWorkload.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatarUrl} alt={u.displayName} data-ai-hint="user avatar" />
                          <AvatarFallback>{u.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{u.displayName}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'supervisor' ? 'secondary' : 'outline'}>{u.role}</Badge>
                    </TableCell>
                    <TableCell className="font-mono font-medium text-center">{u.activeTaskCount}</TableCell>
                    <TableCell>{getWorkloadBadge(u.activeTaskCount)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/admin/users/${u.id}`}>
                          View Details <ArrowRight className="ml-2 h-4 w-4"/>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
