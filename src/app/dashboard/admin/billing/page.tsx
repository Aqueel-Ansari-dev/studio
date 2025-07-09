
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { getBillingInfo, type BillingInfo } from '@/app/actions/admin/getBillingInfo';
import { RefreshCw, Users, Database, Star, ExternalLink, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBillingInfo = useCallback(async () => {
    if (!user?.id) {
      if (!authLoading) toast({ title: "Not authenticated", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const result = await getBillingInfo(user.id);
    if (result.success && result.info) {
      setBillingInfo(result.info);
    } else {
      toast({ title: "Error", description: result.error || "Could not load billing information.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [user?.id, authLoading, toast]);

  useEffect(() => {
    if (user && !authLoading) {
      loadBillingInfo();
    }
  }, [user, authLoading, loadBillingInfo]);

  const userUsagePercentage = billingInfo?.userLimit ? (billingInfo.userCount / billingInfo.userLimit) * 100 : 0;
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing & Subscription" description="Loading your plan details..."/>
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!billingInfo || !billingInfo.plan) {
    return <p>Could not load billing information.</p>;
  }

  const { plan, userCount, userLimit } = billingInfo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your plan, view usage, and access billing history."
        actions={<Button onClick={loadBillingInfo} variant="outline" disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/> Refresh</Button>}
      />

      {userCount >= userLimit && userLimit > 0 && (
        <Alert variant="destructive">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>User Limit Reached</AlertTitle>
            <AlertDescription>
              You have reached your user limit. To invite more users, please upgrade your plan.
            </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <Star className="text-primary"/>
                    Current Plan: {plan.name}
                </CardTitle>
                <CardDescription>
                  {plan.priceMonthly === 0 ? "Free plan" : `${plan.priceMonthly}/month or ${plan.priceYearly}/year`}
                </CardDescription>
              </div>
              <Badge className="text-sm" variant={billingInfo.subscriptionStatus === 'active' ? 'default' : 'destructive'}>{billingInfo.subscriptionStatus}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                  <p className="text-muted-foreground">{plan.features.join(' • ')}</p>
                  <div className="space-y-2">
                    <Label>User Seats</Label>
                    <Progress value={userUsagePercentage > 100 ? 100 : userUsagePercentage} className={userUsagePercentage >= 90 ? "bg-destructive/20 [&>div]:bg-destructive" : ""}/>
                    <p className="text-sm text-muted-foreground">{userCount} of {userLimit > 0 ? userLimit : "Unlimited"} users</p>
                  </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="secondary" disabled>Manage Subscription <ExternalLink className="ml-2 h-4 w-4"/></Button>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={plan.id === 'enterprise'}>Upgrade Plan</Button>
            </CardFooter>
          </Card>
        </div>
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Billing Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <p><strong>Next Billing Date:</strong> Oct 25, 2024</p>
                    <p><strong>Payment Method:</strong> Visa **** **** **** 4242</p>
                    <p><strong>Billing Email:</strong> {user?.email}</p>
                    <Button variant="link" className="p-0 h-auto">View Billing History</Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
