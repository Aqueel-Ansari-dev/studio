
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { XCircle, RefreshCw, Mail } from 'lucide-react';
import { cn } from "@/lib/utils";

interface RegistrationErrorStepProps {
  errorMessage: string;
  onRetry: () => void;
  onContactSupport?: () => void;
}

const RegistrationErrorStep: React.FC<RegistrationErrorStepProps> = ({
  errorMessage,
  onRetry,
  onContactSupport,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground items-center justify-center text-center"
    >
      <div className="w-full max-w-md mx-auto">
        <XCircle className="h-20 w-20 text-destructive mx-auto mb-6 animate-pulse" />
        <h2 className="text-3xl font-bold mb-4 text-destructive">
          Oops, Something Went Wrong!
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          {errorMessage || "We encountered an unexpected issue. Please try again."}
        </p>

        <div className="space-y-4">
          <Button
            onClick={onRetry}
            className="w-full py-3 text-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <RefreshCw className="h-5 w-5 mr-2" /> Try Again
          </Button>
          {onContactSupport && (
            <Button
              onClick={onContactSupport}
              variant="outline"
              className="w-full py-3 text-lg border-destructive text-destructive hover:bg-destructive/10"
            >
              <Mail className="h-5 w-5 mr-2" /> Contact Support
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-8">
          We apologize for the inconvenience.
        </p>
      </div>
    </motion.div>
  );
};

export default RegistrationErrorStep;
