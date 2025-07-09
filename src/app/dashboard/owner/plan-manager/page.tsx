
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { getPlans, updatePlan } from '@/app/actions/owner/managePlans';
import type { Plan, PlanFeature } from '@/types/database';
import { RefreshCw, Save, Crown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const planSchema = z.object({
    name: z.string().min(1, 'Name is required.'),
    priceMonthly: z.number().min(0),
    priceYearly: z.number().min(0),
    userLimit: z.number().min(0),
    features: z.array(z.string()),
    recommended: z.boolean().optional(),
    contactUs: z.boolean().optional(),
});

type PlanFormValues = z.infer<typeof planSchema>;

const ALL_FEATURES: PlanFeature[] = ['Tasks', 'Attendance', 'Expenses', 'Payroll', 'Invoicing', 'Advanced Reporting', 'Priority Support'];

function PlanForm({ plan, onUpdate }: { plan: Plan; onUpdate: () => void }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<PlanFormValues>({
        resolver: zodResolver(planSchema),
        defaultValues: {
            ...plan,
            userLimit: plan.userLimit === Infinity ? 0 : plan.userLimit, // Use 0 for infinity in form
        },
    });

    const onSubmit = async (data: PlanFormValues) => {
        setIsSubmitting(true);
        const updateData = {
            ...data,
            userLimit: data.userLimit === 0 ? Infinity : data.userLimit, // Convert 0 back to Infinity
        };
        const result = await updatePlan(plan.id, updateData);
        if (result.success) {
            toast({ title: "Plan Updated", description: result.message });
            onUpdate();
        } else {
            toast({ title: "Update Failed", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    return (
        <Card>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle className="font-headline">{plan.name}</CardTitle>
                    <CardDescription>Plan ID: {plan.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input placeholder="Plan Name" {...form.register('name')} />
                        <Input type="number" placeholder="User Limit (0 for unlimited)" {...form.register('userLimit', { valueAsNumber: true })} />
                        <Input type="number" placeholder="Monthly Price" {...form.register('priceMonthly', { valueAsNumber: true })} />
                        <Input type="number" placeholder="Yearly Price" {...form.register('priceYearly', { valueAsNumber: true })} />
                    </div>
                    <div>
                        <Label>Features</Label>
                        <div className="space-y-2 rounded-md border p-2">
                           {ALL_FEATURES.map(feature => (
                                <div key={feature} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`${plan.id}-${feature}`}
                                        checked={form.watch('features').includes(feature)}
                                        onCheckedChange={(checked) => {
                                            const currentFeatures = form.getValues('features');
                                            const newFeatures = checked
                                                ? [...currentFeatures, feature]
                                                : currentFeatures.filter(f => f !== feature);
                                            form.setValue('features', newFeatures, { shouldDirty: true });
                                        }}
                                    />
                                    <label htmlFor={`${plan.id}-${feature}`} className="text-sm font-medium leading-none">{feature}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id={`recommended-${plan.id}`} checked={form.watch('recommended')} onCheckedChange={(checked) => form.setValue('recommended', checked, { shouldDirty: true })} />
                        <Label htmlFor={`recommended-${plan.id}`}>Recommended</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id={`contactUs-${plan.id}`} checked={form.watch('contactUs')} onCheckedChange={(checked) => form.setValue('contactUs', checked, { shouldDirty: true })} />
                        <Label htmlFor={`contactUs-${plan.id}`}>Contact Us for Price</Label>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

export default function PlanManagerPage() {
    const { user } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadPlans = useCallback(async () => {
        setIsLoading(true);
        const fetchedPlans = await getPlans();
        fetchedPlans.sort((a, b) => (a.priceMonthly > b.priceMonthly) ? 1 : -1);
        setPlans(fetchedPlans);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if(user?.role === 'owner') {
            loadPlans();
        }
    }, [user, loadPlans]);

    if (isLoading) {
        return (
             <div className="space-y-6">
                <PageHeader title="Plan Manager" description="Loading subscription plans..."/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <PageHeader title="Plan Manager" description="Manage subscription plans for the entire platform." />
            
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center"><Crown className="mr-2"/>Subscription Plans</CardTitle>
                    <CardDescription>Changes made here will be reflected for new and renewing customers.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {plans.map(plan => (
                        <PlanForm key={plan.id} plan={plan} onUpdate={loadPlans} />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
