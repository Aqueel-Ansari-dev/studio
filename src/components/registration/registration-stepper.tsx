
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from "@/lib/utils";

interface RegistrationStepperProps {
  currentStep: number;
}

const totalSteps = 5;

const RegistrationStepper: React.FC<RegistrationStepperProps> = ({
  currentStep,
}) => {
  return (
    <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm py-4 border-b border-border shadow-sm">
      <div className="w-full max-w-md mx-auto px-4">
        <p className="text-sm text-center text-muted-foreground mb-4">
          Step {currentStep} of {totalSteps}
        </p>
        <div className="flex items-center justify-between relative">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            return (
              <React.Fragment key={stepNumber}>
                <motion.div
                  className={cn(
                    "relative flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300",
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground border-2 border-primary"
                      : "bg-secondary text-muted-foreground border border-border"
                  )}
                  initial={{ scale: 1 }}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="font-medium text-sm">{stepNumber}</span>
                  )}
                </motion.div>
                {stepNumber < totalSteps && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 transition-colors duration-300",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RegistrationStepper;
