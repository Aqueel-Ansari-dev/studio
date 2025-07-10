
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion'; // For fade-in animation
import { Progress } from "@/components/ui/progress";
import { PlanType } from "./choose-plan-step";
import { PaymentDetails } from "./billing-payment-step";

interface ConfirmationStepProps {
  organizationName: string;
  selectedPlan: PlanType;
  billingCycle: "monthly" | "yearly";
  paymentDetails: PaymentDetails;
}

const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  organizationName,
  selectedPlan,
  billingCycle,
  paymentDetails,
}) => {
  const router = useRouter();

  const handleStartOnboarding = () => {
    router.push('/dashboard/org-onboarding');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const renewalDate = new Date();
  renewalDate.setFullYear(renewalDate.getFullYear() + (billingCycle === 'yearly' ? 1 : 0));
  if (billingCycle === 'monthly') {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }

  const formattedRenewalDate = renewalDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const usersAllowed = selectedPlan.userLimit === Infinity ? 'Unlimited' : `Up to ${selectedPlan.userLimit}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground items-center justify-center text-center"
    >
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6">
          <Progress value={100} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">Step 5 of 5</p>
        </div>

        <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6 animate-bounce" />
        <h2 className="text-3xl font-bold mb-4 text-foreground">
          Welcome to FieldOps, {organizationName} 🎉
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          Your organization account has been successfully created.
        </p>

        <div className="bg-card p-6 rounded-lg shadow-md mb-8 text-left">
          <h3 className="text-xl font-semibold mb-4">Subscription Summary:</h3>
          <p className="text-muted-foreground mb-2">
            <strong className="text-foreground">Plan:</strong> {selectedPlan.name} (INR{" "}
            {billingCycle === "monthly"
              ? selectedPlan.priceMonthly
              : selectedPlan.priceYearly}
            {selectedPlan.priceMonthly > 0 ? (billingCycle === "monthly" ? "/month" : "/year") : ""})
          </p>
          <p className="text-muted-foreground mb-2">
            <strong className="text-foreground">Users Allowed:</strong> {usersAllowed}
          </p>
          {!selectedPlan.contactUs && selectedPlan.priceMonthly > 0 && (
            <p className="text-muted-foreground">
              <strong className="text-foreground">Next Renewal:</strong> {formattedRenewalDate}
            </p>
          )}
           {selectedPlan.contactUs && (
            <p className="text-muted-foreground">
              <strong className="text-foreground">Renewal:</strong> As per custom agreement
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleStartOnboarding}
            className="w-full py-3 text-lg"
          >
            Start Onboarding Setup
          </Button>
          <Button
            onClick={handleGoToDashboard}
            variant="outline"
            className="w-full py-3 text-lg"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ConfirmationStep;
