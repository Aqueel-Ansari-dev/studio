
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanType = {
  id: 'free' | 'pro' | 'business' | 'enterprise';
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  recommended?: boolean;
  contactUs?: boolean;
};

interface ChoosePlanStepProps {
  onDataChange: (data: { selectedPlan: PlanType | null, billingCycle: 'monthly' | 'yearly' }) => void;
  selectedPlan: PlanType | null;
  billingCycle: 'monthly' | 'yearly' | null;
}

const plans: PlanType[] = [
  {
    id: "free",
    name: "Free Trial",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "Up to 5 Users",
      "Basic Task Management",
      "Standard Reporting",
      "Email Support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 999,
    priceYearly: 9999,
    features: [
      "Up to 50 Users",
      "Advanced Task Management",
      "Customizable Reports",
      "Priority Support",
      "Inventory, Invoicing & Payroll",
    ],
    recommended: true,
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 2499,
    priceYearly: 24999,
    features: [
      "Up to 200 Users",
      "All Pro Features",
      "Advanced Payroll",
      "Dedicated Account Manager",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "All Business Features",
      "Custom Integrations",
      "SLA & Uptime Guarantee",
      "24/7 Premium Support",
    ],
    contactUs: true,
  },
];

const ChoosePlanStep: React.FC<ChoosePlanStepProps> = ({
  onDataChange,
  selectedPlan,
  billingCycle,
}) => {
  const currentBillingCycle = billingCycle || 'monthly';

  const handlePlanSelection = (plan: PlanType) => {
    onDataChange({ selectedPlan: plan, billingCycle: currentBillingCycle });
  };

  const handleBillingCycleChange = (cycle: 'monthly' | 'yearly') => {
    onDataChange({ selectedPlan, billingCycle: cycle });
  }

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-6">
          <Progress value={60} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">Step 3 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Choose Your Plan
        </h2>

        <div className="flex justify-center mb-8">
          <Tabs
            value={currentBillingCycle}
            onValueChange={(value) =>
              handleBillingCycleChange(value as "monthly" | "yearly")
            }
            className="w-[200px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              onClick={() => handlePlanSelection(plan)}
              className={cn(
                "flex flex-col justify-between cursor-pointer transition-all",
                selectedPlan?.name === plan.name ? "border-primary shadow-lg ring-2 ring-primary" : "hover:shadow-md",
                plan.recommended && selectedPlan?.name !== plan.name && "border-primary/50",
                plan.name === "Free Trial" && "opacity-75"
              )}
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold mb-2">
                  {plan.name}
                </CardTitle>
                <CardDescription
                  className={cn(plan.recommended && "text-primary")}
                >
                  {plan.recommended && "Recommended"}
                </CardDescription>
                <CardContent className="p-0 mt-4">
                  {plan.contactUs ? (
                    <p className="text-3xl font-bold">Custom Quote</p>
                  ) : (
                    <p className="text-3xl font-bold">
                      ₹
                      {currentBillingCycle === "monthly"
                        ? plan.priceMonthly
                        : plan.priceYearly}
                      <span className="text-base font-normal text-muted-foreground">
                        {plan.priceMonthly > 0
                          ? currentBillingCycle === "monthly"
                            ? "/month"
                            : "/year"
                          : ""}
                      </span>
                    </p>
                  )}
                </CardContent>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground flex-grow">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-primary" /> {feature}
                  </div>
                ))}
              </CardContent>
              <CardFooter className="mt-auto p-4 pt-0">
                <Button
                  className="w-full"
                  variant={selectedPlan?.name === plan.name ? 'default' : 'outline'}
                >
                  {selectedPlan?.name === plan.name ? "Selected" : plan.name === "Free Trial" ? "Start Free Trial" : "Choose Plan"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChoosePlanStep;
