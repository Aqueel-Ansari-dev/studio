
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Building, Users, DollarSign, Activity, Crown } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, description }: { title: string; value: string; icon: React.ElementType; description: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);


export default function OwnerDashboardPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if(user?.role === 'owner') {
            // In a real app, you'd fetch stats here.
            // For now, we just simulate a loading state.
            setTimeout(() => setIsLoading(false), 500);
        }
    }, [user]);

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
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96" />
                </div>
            </div>
        )
    }
    
    if (user?.role !== 'owner') {
        return <p>Access Denied.</p>;
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Owner Dashboard" description="System-wide analytics and platform management." />
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Organizations" value="1,234" icon={Building} description="+201 since last month" />
                <StatCard title="Active Subscriptions" value="982" icon={Users} description="+180 since last month" />
                <StatCard title="Monthly Recurring Revenue" value="$45,231.89" icon={DollarSign} description="+20.1% from last month" />
                <StatCard title="Active Users (24h)" value="573" icon={Activity} description="+32 since last hour" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Signups Over Time</CardTitle>
                        <CardDescription>Monthly new organization signups.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 bg-muted rounded-md flex items-center justify-center">
                        <BarChart className="h-16 w-16 text-muted-foreground" />
                        <p className="text-muted-foreground ml-4">Chart Placeholder</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Plan Distribution</CardTitle>
                        <CardDescription>Distribution of active subscriptions across plans.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 bg-muted rounded-md flex items-center justify-center">
                        <Crown className="h-16 w-16 text-muted-foreground" />
                        <p className="text-muted-foreground ml-4">Chart Placeholder</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
