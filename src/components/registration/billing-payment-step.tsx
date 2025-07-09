
"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { CreditCard, Calendar, Lock, ShieldCheck, Banknote } from "lucide-react";
import { PlanType } from "./choose-plan-step";
import { useToast } from "@/hooks/use-toast";

interface CardDetails {
  nameOnCard: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
}

export interface PaymentDetails {
  method: "card" | "upi" | "";
  cardDetails: CardDetails | null;
  upiId: string | null;
  billingAddress: string;
  subscriptionId: string;
}

interface BillingPaymentStepProps {
  onDataChange: (paymentDetails: Partial<PaymentDetails>) => void;
  selectedPlan: PlanType;
  billingCycle: "monthly" | "yearly";
  paymentDetails: PaymentDetails | null;
}

const BillingPaymentStep: React.FC<BillingPaymentStepProps> = ({
  onDataChange,
  selectedPlan,
  billingCycle,
  paymentDetails,
}) => {
  const [isProcessing] = useState<boolean>(false);
  const { toast } = useToast();

  const handlePaymentMethodChange = (method: "card" | "upi") => {
    onDataChange({
      ...paymentDetails,
      method,
      cardDetails: method === 'card' ? (paymentDetails?.cardDetails || { nameOnCard: "", cardNumber: "", expiryDate: "", cvv: "" }) : null,
      upiId: method === 'upi' ? (paymentDetails?.upiId || "") : null,
    });
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    onDataChange({
      ...paymentDetails,
      cardDetails: {
        ...(paymentDetails?.cardDetails || { nameOnCard: "", cardNumber: "", expiryDate: "", cvv: "" }),
        [id]: value,
      },
    });
  };
  
  const handleUpiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDataChange({ ...paymentDetails, upiId: e.target.value });
  };

  const handleBillingAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDataChange({ ...paymentDetails, billingAddress: e.target.value });
  };

  const handleTestPayment = () => {
    onDataChange({
      method: "card",
      cardDetails: {
        nameOnCard: "Test User",
        cardNumber: "4242424242424242",
        expiryDate: "12/25",
        cvv: "123",
      },
      upiId: null,
      billingAddress: "123 Test St, Test City",
      subscriptionId: `sub_test_${Date.now()}`
    });
    toast({
      title: "Test Payment Data Loaded",
      description: "Dummy card data has been pre-filled.",
    });
  };

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6">
          <Progress value={80} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">Step 4 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Secure Payment
        </h2>

        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">Select Payment Method</Label>
            <RadioGroup
              onValueChange={handlePaymentMethodChange}
              value={paymentDetails?.method}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card">
                  <CreditCard className="inline-block mr-1" /> Card
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="upi" id="upi" />
                <Label htmlFor="upi">
                  <Banknote className="inline-block mr-1" /> UPI
                </Label>
              </div>
            </RadioGroup>
          </div>

          {paymentDetails?.method === "card" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="nameOnCard" className="mb-2 block">
                  Name on Card <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nameOnCard"
                  type="text"
                  placeholder="Full Name on Card"
                  value={paymentDetails?.cardDetails?.nameOnCard || ""}
                  onChange={handleCardChange}
                />
              </div>

              <div>
                <Label htmlFor="cardNumber" className="mb-2 block">
                  Card Number <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cardNumber"
                    type="text"
                    placeholder="XXXX XXXX XXXX XXXX"
                    value={(paymentDetails?.cardDetails?.cardNumber || "")
                      .replace(/\s/g, "")
                      .replace(/(\d{4})/g, "$1 ")
                      .trim()}
                    onChange={handleCardChange}
                    maxLength={19}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiryDate" className="mb-2 block">
                    Expiry Date <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="expiryDate"
                      type="text"
                      placeholder="MM/YY"
                      value={(paymentDetails?.cardDetails?.expiryDate || "")
                        .replace(/[^0-9]/g, "")
                        .replace(/^(\d{2})/, "$1/")
                        .slice(0, 5)}
                      onChange={handleCardChange}
                      maxLength={5}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cvv" className="mb-2 block">
                    CVV <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cvv"
                      type="text"
                      placeholder="123"
                      value={paymentDetails?.cardDetails?.cvv || ""}
                      onChange={handleCardChange}
                      maxLength={4}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {paymentDetails?.method === "upi" && (
            <div>
              <Label htmlFor="upiId" className="mb-2 block">
                UPI ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upiId"
                type="text"
                placeholder="yourname@bankupi"
                value={paymentDetails?.upiId || ""}
                onChange={handleUpiChange}
              />
            </div>
          )}

          <div>
            <Label htmlFor="billingAddress" className="mb-2 block">
              Billing Address (Optional)
            </Label>
            <Input
              id="billingAddress"
              type="text"
              placeholder="123 Main St, Anytown, State, Zip"
              value={paymentDetails?.billingAddress || ""}
              onChange={handleBillingAddressChange}
            />
          </div>

          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 mr-2 text-green-500" /> 🔒 100% Secure
          </div>

          <Button
            type="button"
            className="w-full py-3 text-lg invisible" // This button is not used, parent handles submission
          >
            Pay & Register Organization
          </Button>

          <Button
            type="button"
            onClick={handleTestPayment}
            variant="outline"
            className="w-full py-3 text-lg mt-2"
            disabled={isProcessing}
          >
            Load Test Payment Data
          </Button>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>You are about to subscribe to the {selectedPlan.name} plan at ₹
          {billingCycle === "monthly"
            ? selectedPlan.priceMonthly
            : selectedPlan.priceYearly}
          {selectedPlan.priceMonthly > 0 ? (billingCycle === "monthly" ? "/month" : "/year") : ""}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingPaymentStep;
