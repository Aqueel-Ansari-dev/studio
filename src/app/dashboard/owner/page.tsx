
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, Users, DollarSign, ArrowUp, XCircle, RefreshCw } from 'lucide-react';
import { getOwnerDashboardStats, OwnerDashboardStats } from '@/app/actions/owner/getOwnerDashboardStats';
import { getSubscriptionStats, SubscriptionStats } from '@/app/actions/owner/getSubscriptionStats';
import { getUsageHeatmapData, HeatmapDataPoint } from '@/app/actions/owner/getUsageHeatmapData';
import { UserRolePieChart } from '@/components/owner/user-role-pie-chart';
import { ActivityLineChart } from '@/components/owner/activity-line-chart';
import { SubscriptionOverview } from '@/components/owner/SubscriptionOverview';
import { UsageHeatmap } from '@/components/owner/UsageHeatmap';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

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
    const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null);
    const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [statsRes, subsRes, heatmapRes] = await Promise.all([
          getOwnerDashboardStats(),
          getSubscriptionStats(),
          getUsageHeatmapData()
        ]);

        if (statsRes.success && statsRes.stats) setStats(statsRes.stats);
        else throw new Error(statsRes.error || "Failed to load dashboard stats.");

        if (subsRes.success && subsRes.stats) setSubscriptionStats(subsRes.stats);
        else throw new Error(subsRes.error || "Failed to load subscription stats.");
        
        if (heatmapRes.success && heatmapRes.data) setHeatmapData(heatmapRes.data);
        else throw new Error(heatmapRes.error || "Failed to load usage data.");

      } catch (e: any) {
        setError(e.message);
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
      setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        if(user?.role === 'owner') {
            loadData();
        }
    }, [user, loadData]);
    
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
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-72" />
                    <Skeleton className="h-72" />
                </div>
            </div>
        )
    }
    
    if (user?.role !== 'owner') {
        return <p>Access Denied.</p>;
    }
    
    if (error) {
       return (
        <div className="space-y-6">
            <PageHeader title="Owner Dashboard" description="System-wide analytics and platform management." />
            <Card className="text-center p-8">
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Could not load dashboard data</h2>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                <Button onClick={loadData} className="mt-4"><RefreshCw className="mr-2 h-4 w-4"/>Retry</Button>
            </Card>
        </div>
       )
    }
    
    if (!stats) {
      return (
        <div className="space-y-6">
            <PageHeader title="Owner Dashboard" description="System-wide analytics and platform management." />
            <Card className="text-center p-8">
                <h2 className="mt-4 text-xl font-semibold">No data available</h2>
                <p className="mt-2 text-sm text-muted-foreground">Promote your app to get your first organization registered!</p>
            </Card>
        </div>
      )
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
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SubscriptionOverview stats={subscriptionStats} isLoading={isLoading} />
                <UsageHeatmap data={heatmapData} isLoading={isLoading} />
            </div>
        </div>
    );
}
