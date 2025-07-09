
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, Users, DollarSign, ArrowUp } from 'lucide-react';
import { getOwnerDashboardStats, OwnerDashboardStats } from '@/app/actions/owner/getOwnerDashboardStats';
import { UserRolePieChart } from '@/components/owner/user-role-pie-chart';
import { ActivityLineChart } from '@/components/owner/activity-line-chart';
import { useToast } from '@/hooks/use-toast';

const StatCard = ({ title, value, icon: Icon, description, isCurrency = false }: { title: string; value: string | number; icon: React.ElementType; description: string; isCurrency?: boolean }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{isCurrency ? `$${Number(value).toLocaleString()}` : Number(value).toLocaleString()}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export default function OwnerDashboardPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<OwnerDashboardStats | null>(null);

    const loadStats = useCallback(async () => {
      setIsLoading(true);
      const result = await getOwnerDashboardStats();
      if (result.success && result.stats) {
        setStats(result.stats);
      } else {
        toast({ title: "Error", description: result.error || "Could not load owner dashboard stats.", variant: "destructive" });
      }
      setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        if(user?.role === 'owner') {
            loadStats();
        }
    }, [user, loadStats]);

    if (isLoading) {
        return (
             <div className="space-y-6">
                <PageHeader title="Owner Dashboard" description="Loading platform data..."/>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                </div>
                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3"><Skeleton className="h-96" /></div>
                    <div className="lg:col-span-2"><Skeleton className="h-96" /></div>
                </div>
            </div>
        )
    }
    
    if (user?.role !== 'owner' || !stats) {
        return <p>Access Denied or data could not be loaded.</p>;
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Owner Dashboard" description="System-wide analytics and platform management." />
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Organizations" value={stats.totalOrgs} icon={Building} description={`+${stats.newOrgsLastWeek} in last 7 days`} />
                <StatCard title="Total Users" value={stats.totalUsers} icon={Users} description={`+${stats.newUsersLastWeek} in last 7 days`} />
                <StatCard title="Monthly Recurring Revenue" value={stats.mrr} icon={DollarSign} description="+20.1% from last month" isCurrency />
                <StatCard title="Weekly Growth" value={`${stats.weeklyGrowthPercentage}%`} icon={ArrowUp} description="New users this week" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                 <div className="lg:col-span-3">
                    <ActivityLineChart initialData={stats.activity} />
                 </div>
                 <div className="lg:col-span-2">
                    <UserRolePieChart roleCounts={stats.userRoleCounts} totalUsers={stats.totalUsers} />
                 </div>
            </div>
        </div>
    );
}

