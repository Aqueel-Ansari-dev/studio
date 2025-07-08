
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { Separator } from "@/components/ui/separator";
import OnboardingChecklist from "@/components/admin/onboarding-checklist";

const OrgOnboardingPage: React.FC = () => {
  const router = useRouter();

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  // In a real application, you might fetch the organization name and admin info
  // from session or a backend call after authentication.
  const organizationName = "Your Organization"; // Placeholder
  const adminName = "Admin User"; // Placeholder

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-center">
          Welcome, {adminName} to {organizationName}!
        </h1>
        <p className="text-lg text-muted-foreground text-center mb-8">
          Let's get your FieldOps account set up. Complete these essential steps to get started.
        </p>

        <Separator className="my-8" />

        <OnboardingChecklist />

        <Separator className="my-8" />

        <div className="flex justify-center mt-8">
          <Button onClick={handleGoToDashboard} variant="outline" className="py-3 px-6 text-lg">
            Skip for now & Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrgOnboardingPage;
