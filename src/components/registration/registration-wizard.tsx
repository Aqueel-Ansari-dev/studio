"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RegistrationStepper from "./registration-stepper";
import RegistrationBottomNav from "./registration-bottom-nav";
import OrganizationInfoStep from "./organization-info-step";
import AdminAccountStep from "./admin-account-step";
import ChoosePlanStep, { PlanType } from "./choose-plan-step";
import BillingPaymentStep, { PaymentDetails } from "./billing-payment-step";
import ConfirmationStep from "./confirmation-step";
import RegistrationErrorStep from "./registration-error-step"; // Import the new error step
import { Card, CardContent } from "@/components/ui/card";
import { useMediaQuery } from "@/hooks/use-media-query";
import { registerOrganization } from "@/app/actions/admin/registerOrganization"; // Import the server action

// Define a type for all registration form data
interface RegistrationData {
  organizationName: string;
  industryType: "Construction" | "Interior" | "Electrical" | "Civil" | "Fabrication" | "Other" | "";
  organizationSize: "1-10" | "11-50" | "51-200" | "200+" | "";
  fullName: string;
  workEmail: string;
  phoneNumber: string;
  passwordUser: string;
  selectedPlan: PlanType | null;
  billingCycle: "monthly" | "yearly" | null;
  paymentDetails: PaymentDetails | null;
}

const initialRegistrationData: RegistrationData = {
  organizationName: "",
  industryType: "",
  organizationSize: "",
  fullName: "",
  workEmail: "",
  phoneNumber: "",
  passwordUser: "",
  selectedPlan: null,
  billingCycle: null,
  paymentDetails: null,
};

const RegistrationWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationData>(initialRegistrationData);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const totalSteps = 5;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // This function is now responsible ONLY for updating the formData state
  const handleDataChange = (data: Partial<RegistrationData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // This function is called when the NEXT button in the bottom navigation is clicked
  const handleNextStep = async () => {
    // If it's the payment step (Step 4), trigger backend registration
    if (currentStep === 4) {
      if (!formData.selectedPlan || !formData.billingCycle || !formData.paymentDetails) {
        setRegistrationError("Missing plan, billing, or payment details.");
        setCurrentStep(6); // Go to an error step
        return;
      }

      setIsRegistering(true);
      setRegistrationError(null);

      try {
        const result = await registerOrganization({
          organizationName: formData.organizationName,
          industryType: formData.industryType as "Construction" | "Interior" | "Electrical" | "Civil" | "Fabrication" | "Other",
          organizationSize: formData.organizationSize as "1-10" | "11-50" | "51-200" | "200+",
          fullName: formData.fullName,
          workEmail: formData.workEmail,
          phoneNumber: formData.phoneNumber,
          passwordUser: formData.passwordUser,
          selectedPlan: formData.selectedPlan,
          billingCycle: formData.billingCycle,
          paymentDetails: formData.paymentDetails,
        });

        if (result.success) {
          setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
        } else {
          setRegistrationError(result.error || "An unknown error occurred during registration.");
          setCurrentStep(6); // Go to an error step (step 6 for error)
        }
      } catch (error: any) {
        console.error("Registration submission error:", error);
        setRegistrationError(error.message || "An unexpected error occurred.");
        setCurrentStep(6); // Go to an error step
      } finally {
        setIsRegistering(false);
      }
    } else {
      // For other steps, just advance the step
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setRegistrationError(null); // Clear any errors when going back
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleRetryRegistration = () => {
    setRegistrationError(null);
    setCurrentStep(4); // Go back to the payment step to retry
  };

  // Determine if the 'Next' button should be disabled for the current step
  const isNextDisabled = () => {
    if (isRegistering) return true; // Disable if registration is in progress

    switch (currentStep) {
      case 1:
        return !formData.organizationName || !formData.industryType || !formData.organizationSize;
      case 2:
        return !formData.fullName || !formData.workEmail || !formData.phoneNumber || !formData.passwordUser;
      case 3:
        return !formData.selectedPlan || formData.selectedPlan?.contactUs;
      case 4:
        // BillingPaymentStep now propagates its data; check if paymentDetails are sufficient
        return !formData.paymentDetails || (formData.paymentDetails.method === "card" && (!formData.paymentDetails.cardDetails?.cardNumber || !formData.paymentDetails.cardDetails?.cvv || !formData.paymentDetails.cardDetails?.expiryDate || !formData.paymentDetails.cardDetails?.nameOnCard)) || (formData.paymentDetails.method === "upi" && !formData.paymentDetails.upiId);
      default:
        return false;
    }
  };

  const getStepIllustration = (step: number) => {
    switch (step) {
      case 1:
        return (
          <div className="p-8">
            <h3 className="text-xl font-semibold mb-2 text-foreground">Organization Details</h3>
            <p className="text-muted-foreground">Tell us about your company to get started. This helps us tailor your experience.</p>
            <div className="mt-8 h-48 bg-primary/10 rounded-lg flex items-center justify-center text-primary-foreground/50">
              <p>Illustration: Company Profile</p>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="p-8">
            <h3 className="text-xl font-semibold mb-2 text-foreground">Admin Account Setup</h3>
            <p className="text-muted-foreground">Set up your primary administrator account. This will be your main login.</p>
            <div className="mt-8 h-48 bg-primary/10 rounded-lg flex items-center justify-center text-primary-foreground/50">
              <p>Illustration: User Profile</p>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="p-8">
            <h3 className="text-xl font-semibold mb-2 text-foreground">Choose Your Plan</h3>
            <p className="text-muted-foreground">Select the perfect plan that fits your organization's needs and scale.</p>
            <div className="mt-8 h-48 bg-primary/10 rounded-lg flex items-center justify-center text-primary-foreground/50">
              <p>Illustration: Pricing</p>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="p-8">
            <h3 className="text-xl font-semibold mb-2 text-foreground">Secure Payment</h3>
            <p className="text-muted-foreground">Enter your billing details to activate your subscription securely.</p>
            <div className="mt-8 h-48 bg-primary/10 rounded-lg flex items-center justify-center text-primary-foreground/50">
              <p>Illustration: Payment</p>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="p-8">
            <h3 className="text-xl font-semibold mb-2 text-foreground">Registration Complete!</h3>
            <p className="text-muted-foreground">You're all set! Get ready to streamline your field operations.</p>
            <div className="mt-8 h-48 bg-primary/10 rounded-lg flex items-center justify-center text-primary-foreground/50">
              <p>Illustration: Success</p>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="p-8">
            <h3 className="text-xl font-semibold mb-2 text-foreground">Registration Failed</h3>
            <p className="text-muted-foreground">We encountered an issue during your registration. Please try again.</p>
            <div className="mt-8 h-48 bg-destructive/10 rounded-lg flex items-center justify-center text-destructive/50">
              <p>Illustration: Error</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {currentStep !== 6 && <RegistrationStepper currentStep={currentStep} />}

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <Card className="w-full max-w-5xl shadow-lg border-border/50 overflow-hidden md:grid md:grid-cols-[2fr_3fr] lg:grid-cols-[1.5fr_2.5fr]">
          {isDesktop && (
            <div className="hidden md:flex flex-col justify-center bg-muted/20 p-6">
              {getStepIllustration(currentStep)}
            </div>
          )}
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {
                  {
                    1: (
                      <OrganizationInfoStep
                        onDataChange={handleDataChange}
                        initialOrganizationName={formData.organizationName}
                        initialIndustryType={formData.industryType}
                        initialOrganizationSize={formData.organizationSize}
                      />
                    ),
                    2: (
                      <AdminAccountStep
                        onDataChange={handleDataChange}
                        initialFullName={formData.fullName}
                        initialWorkEmail={formData.workEmail}
                        initialPhoneNumber={formData.phoneNumber}
                        initialPasswordUser={formData.passwordUser}
                      />
                    ),
                    3: (
                      <ChoosePlanStep
                        onDataChange={(plan, cycle) =>
                          handleDataChange({ selectedPlan: plan, billingCycle: cycle })
                        }
                        initialSelectedPlan={formData.selectedPlan}
                        initialBillingCycle={formData.billingCycle}
                      />
                    ),
                    4: formData.selectedPlan && formData.billingCycle ? (
                      <BillingPaymentStep
                        onDataChange={(paymentDetails) => handleDataChange({ paymentDetails })}
                        selectedPlan={formData.selectedPlan}
                        billingCycle={formData.billingCycle}
                        initialPaymentMethod={formData.paymentDetails?.method || ""}
                        initialCardDetails={formData.paymentDetails?.cardDetails || null}
                        initialUpiId={formData.paymentDetails?.upiId || null}
                        initialBillingAddress={formData.paymentDetails?.billingAddress || ""}
                      />
                    ) : (
                      <div className="p-8 text-center text-destructive">Please go back and select a plan.</div>
                    ),
                    5: formData.organizationName && formData.selectedPlan && formData.billingCycle && formData.paymentDetails ? (
                      <ConfirmationStep
                        organizationName={formData.organizationName}
                        selectedPlan={formData.selectedPlan}
                        billingCycle={formData.billingCycle}
                        paymentDetails={formData.paymentDetails}
                      />
                    ) : (
                      <div className="p-8 text-center text-destructive">Please complete previous steps.</div>
                    ),
                    6: (
                      <RegistrationErrorStep
                        errorMessage={registrationError || "An unknown error occurred."}
                        onRetry={handleRetryRegistration}
                      />
                    ),
                  }[currentStep]
                }
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </main>

      {currentStep !== 6 && (
        <RegistrationBottomNav
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={handleBack}
          onNext={handleNextStep} // Now calls the dedicated step advancement function
          isNextDisabled={isNextDisabled()}
        />
      )}
    </div>
  );
};

export default RegistrationWizard;
