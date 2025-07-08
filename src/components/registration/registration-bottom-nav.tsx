
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query"; // Assuming this hook exists

interface RegistrationBottomNavProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  isNextDisabled?: boolean;
}

const RegistrationBottomNav: React.FC<RegistrationBottomNavProps> = ({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isNextDisabled = false,
}) => {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (!isMobile) {
    return null; // Only show on mobile viewports
  }

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-t border-border shadow-[0_-2px_5px_rgba(0,0,0,0.05)] py-3 px-4 safe-area-inset-bottom md:hidden"
    >
      <div className="flex justify-between items-center max-w-lg mx-auto">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={currentStep === 1}
          className="pr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button
          onClick={onNext}
          disabled={isNextDisabled || currentStep === totalSteps}
          className="pl-4"
        >
          Next <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </motion.nav>
  );
};

export default RegistrationBottomNav;
