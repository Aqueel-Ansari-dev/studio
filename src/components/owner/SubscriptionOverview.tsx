
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SubscriptionStats } from '@/app/actions/owner/getSubscriptionStats';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign } from 'lucide-react';

interface SubscriptionOverviewProps {
  stats: SubscriptionStats | null;
  isLoading: boolean;
}

export function SubscriptionOverview({ stats, isLoading }: SubscriptionOverviewProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const currentStats = stats ? stats[billingCycle] : { revenue: 0, count: 0 };
  const cycleLabel = billingCycle === 'monthly' ? 'MRR' : 'ARR';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!stats) {
    return (
         <Card>
            <CardHeader>
                <CardTitle>Subscription Overview</CardTitle>
                <CardDescription>Could not load subscription data.</CardDescription>
            </CardHeader>
         </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Subscription Overview</CardTitle>
            <CardDescription>Revenue and top organizations.</CardDescription>
          </div>
          <div className="flex bg-muted p-1 rounded-md">
            <Button
                variant={billingCycle === 'monthly' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setBillingCycle('monthly')}
                className="rounded-sm px-3"
                aria-pressed={billingCycle === 'monthly'}
            >
                Monthly
            </Button>
            <Button
                variant={billingCycle === 'yearly' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setBillingCycle('yearly')}
                className="rounded-sm px-3"
                aria-pressed={billingCycle === 'yearly'}
            >
                Yearly
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-around items-center bg-muted p-4 rounded-lg mb-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{cycleLabel}</p>
            <p className="text-3xl font-bold">{formatCurrency(currentStats.revenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Active Orgs</p>
            <p className="text-3xl font-bold">{currentStats.count}</p>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Top 5 Paying Orgs (by MRR)</h4>
          <ul className="space-y-2">
            {stats.topPayingOrgs.length > 0 ? stats.topPayingOrgs.map(org => (
              <li key={org.id} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                <span className="font-medium truncate">{org.name}</span>
                <Badge variant="outline">{org.planName}</Badge>
              </li>
            )) : <p className="text-sm text-muted-foreground text-center py-2">No paying organizations found.</p>}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
