
"use client";

import React, { useState } from "react";
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
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  recommended?: boolean;
  contactUs?: boolean;
};

interface ChoosePlanStepProps {
  onNext: (selectedPlan: PlanType, billingCycle: 'monthly' | 'yearly') => void;
}

const plans: PlanType[] = [
  {
    name: "Free Trial",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "Limited Users (Up to 5)",
      "Basic Task Management",
      "Standard Reporting",
      "Email Support",
    ],
  },
  {
    name: "Pro",
    priceMonthly: 999,
    priceYearly: 9999,
    features: [
      "Unlimited Users",
      "Advanced Task Management",
      "Customizable Reports",
      "Priority Support",
      "Inventory Management",
    ],
    recommended: true,
  },
  {
    name: "Business",
    priceMonthly: 2499,
    priceYearly: 24999,
    features: [
      "All Pro Features",
      "Multi-Company Support",
      "Advanced Payroll",
      "Dedicated Account Manager",
      "API Access",
      "On-Premise Deployment Option"
    ],
  },
  {
    name: "Enterprise",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "All Business Features",
      "Custom Integrations",
      "SLA & Uptime Guarantee",
      "24/7 Premium Support",
      "On-site Training",
    ],
    contactUs: true,
  },
];

const ChoosePlanStep: React.FC<ChoosePlanStepProps> = ({ onNext }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(
    "monthly"
  );

  const handleChoosePlan = (plan: PlanType) => {
    onNext(plan, billingCycle);
  };

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-6">
          <Progress value={60} className="w-full" />{" "}
          {/* Assuming 60% for Step 3 of 5 */}
          <p className="text-sm text-muted-foreground mt-2">Step 3 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Choose Your Plan
        </h2>

        <div className="flex justify-center mb-8">
          <Tabs
            defaultValue="monthly"
            onValueChange={(value) =>
              setBillingCycle(value as "monthly" | "yearly")
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
              className={cn(
                "flex flex-col justify-between",
                plan.recommended &&
                  "border-primary shadow-lg ring-2 ring-primary",
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
                      {billingCycle === "monthly"
                        ? plan.priceMonthly
                        : plan.priceYearly}
                      <span className="text-base font-normal text-muted-foreground">
                        {plan.priceMonthly > 0
                          ? billingCycle === "monthly"
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
                  onClick={() => handleChoosePlan(plan)}
                  className="w-full"
                  disabled={plan.name === "Free Trial"}
                >
                  {plan.name === "Free Trial" ? "Start Free Trial" : "Choose Plan"}
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
