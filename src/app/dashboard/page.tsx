
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Briefcase, UserCog } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      switch (user.role) {
        case 'employee':
          router.replace('/dashboard/employee/projects');
          break;
        case 'supervisor':
          router.replace('/dashboard/supervisor/overview');
          break;
        case 'admin':
          router.replace('/dashboard/admin/overview');
          break;
        default:
          // Fallback if role is somehow undefined or unexpected
          router.replace('/'); 
          break;
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex justify-center items-center h-screen"><p>Loading dashboard...</p></div>;
  }
  
  // This content will be briefly visible before redirection, or if redirection fails.
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-headline">Welcome to FieldOps MVP</h1>
      <p className="text-muted-foreground">
        Your central hub for managing field operations. You will be redirected shortly based on your role.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employee View</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Access your projects and tasks.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supervisor View</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Manage your team and assign tasks.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin View</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Oversee operations and system settings.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
