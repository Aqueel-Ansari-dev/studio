
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
import { checkTrialStatuses } from '@/app/actions/admin/billing/checkTrialStatuses';
import { upgradeOrganizationPlan } from '@/app/actions/admin/billing/upgradePlan';
import { getPlanById, getPlans } from '@/lib/plans';
import { RefreshCw, Users, Star, ExternalLink, ShieldCheck, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

export default function BillingPage() {
  const { user, loading: authLoading, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingTrials, setIsCheckingTrials] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const loadBillingInfo = useCallback(async () => {
    if (!user?.id || !user.organizationId) {
      if (!authLoading) toast({ title: "Not authenticated", description: "User or organization could not be determined.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const result = await getBillingInfo(user.id, user.organizationId);
    if (result.success && result.info) {
      setBillingInfo(result.info);
    } else {
      toast({ title: "Error", description: result.error || "Could not load billing information.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [user, authLoading, toast]);

  useEffect(() => {
    if (user && !authLoading) {
      loadBillingInfo();
    }
  }, [user, authLoading, loadBillingInfo]);
  
  const handleCheckTrials = async () => {
    if (!user?.id) return;
    setIsCheckingTrials(true);
    const result = await checkTrialStatuses(user.id);
    toast({
      title: result.success ? "Trial Status Check Complete" : "Trial Status Check Failed",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
    setIsCheckingTrials(false);
  };
  
  const handleUpgrade = async () => {
    if (!user?.id || !user.organizationId || !billingInfo?.plan) return;
    
    let nextPlanId: 'pro' | 'business' | 'enterprise' = 'pro';
    if (billingInfo.plan.id === 'free' || billingInfo.plan.id === 'pro') {
      nextPlanId = 'business';
    } else if (billingInfo.plan.id === 'business') {
      nextPlanId = 'enterprise';
    } else {
        toast({ title: "No Upgrade Path", description: "You are already on the highest plan." });
        return;
    }
    const nextPlan = await getPlanById(nextPlanId);
    if(!nextPlan) return;

    setIsUpgrading(true);
    const result = await upgradeOrganizationPlan(user.id, user.organizationId, nextPlan);
    if (result.success) {
      toast({ title: "Plan Upgraded!", description: result.message });
      // Update local context immediately for a better UX
      updateUserProfileInContext({ planId: nextPlan.id, subscriptionStatus: 'active' });
      await loadBillingInfo(); // Re-fetch to get latest server state
    } else {
      toast({ title: "Upgrade Failed", description: result.message, variant: 'destructive' });
    }
    setIsUpgrading(false);
  };


  const userUsagePercentage = billingInfo?.userLimit && billingInfo?.userLimit > 0 ? (billingInfo.userCount / billingInfo.userLimit) * 100 : 0;
  
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
    return (
        <div className="space-y-6">
            <PageHeader title="Billing & Subscription" description="Manage your plan, view usage, and access billing history."/>
            <Card>
                <CardHeader>
                    <CardTitle>Error Loading Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Could not load billing information. Please try refreshing the page.</p>
                     <Button onClick={loadBillingInfo} variant="outline" className="mt-4" disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/> Refresh</Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  const { plan, userCount, userLimit } = billingInfo;
  const isNearLimit = userLimit > 0 && (userCount / userLimit) >= 0.9;
  const isTrial = billingInfo.subscriptionStatus === 'trialing';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your plan, view usage, and access billing history."
        actions={
          <div className="flex gap-2">
            <Button onClick={handleCheckTrials} variant="ghost" disabled={isLoading || isCheckingTrials}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isCheckingTrials ? 'animate-spin' : ''}`}/> Check Trial Statuses
            </Button>
            <Button onClick={loadBillingInfo} variant="outline" disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/> Refresh
            </Button>
          </div>
        }
      />

      {isTrial && user?.trialEndsAt && (
        <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertTitle>Pro Trial Active</AlertTitle>
            <AlertDescription>
              Your trial ends in {formatDistanceToNowStrict(parseISO(user.trialEndsAt as string), { addSuffix: true })}. Upgrade now to keep your Pro features.
              <Button onClick={handleUpgrade} size="sm" className="ml-4" disabled={isUpgrading}>
                  {isUpgrading ? 'Upgrading...' : 'Upgrade Now'}
              </Button>
            </AlertDescription>
        </Alert>
      )}

      {userCount >= userLimit && userLimit > 0 && !isTrial && (
        <Alert variant="destructive">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>User Limit Reached</AlertTitle>
            <AlertDescription>
              You have reached your user limit. To invite more users, please upgrade your plan.
               <Button onClick={handleUpgrade} size="sm" className="ml-4" disabled={isUpgrading}>
                  {isUpgrading ? 'Upgrading...' : 'Upgrade Plan'}
              </Button>
            </AlertDescription>
        </Alert>
      )}

      {isNearLimit && userCount < userLimit && !isTrial && (
         <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-800">
            <Users className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Nearing User Limit</AlertTitle>
            <AlertDescription>
              You are approaching your user limit ({userCount} of {userLimit}). Consider upgrading your plan to add more team members.
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
                  {plan.priceMonthly === 0 && !plan.contactUs ? "Free plan" : plan.contactUs ? "Custom Pricing" : `₹${plan.priceMonthly}/month or ₹${plan.priceYearly}/year`}
                </CardDescription>
              </div>
              <Badge className="text-sm capitalize" variant={billingInfo.subscriptionStatus === 'active' || billingInfo.subscriptionStatus === 'trialing' ? 'default' : 'destructive'}>{billingInfo.subscriptionStatus}</Badge>
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
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleUpgrade} disabled={plan.id === 'enterprise' || isUpgrading}>
                    {isUpgrading ? 'Upgrading...' : 'Upgrade Plan'}
                </Button>
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
