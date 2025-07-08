
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

interface PaymentDetails {
  method: "card" | "upi" | "";
  cardDetails: CardDetails | null;
  upiId: string | null;
  billingAddress: string;
  subscriptionId: string;
}

interface BillingPaymentStepProps {
  onNext: (paymentDetails: PaymentDetails) => void;
  selectedPlan: PlanType;
  billingCycle: "monthly" | "yearly";
}

const BillingPaymentStep: React.FC<BillingPaymentStepProps> = ({
  onNext,
  selectedPlan,
  billingCycle,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "">("");
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    nameOnCard: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
  });
  const [upiId, setUpiId] = useState<string>("");
  const [billingAddress, setBillingAddress] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    paymentMethod?: string;
    nameOnCard?: string;
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
    upiId?: string;
  }>({});

  const { toast } = useToast();

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setCardDetails((prev) => ({
      ...prev,
      [id]: value,
    }));
    setErrors((prev) => ({ ...prev, [id]: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: {
      paymentMethod?: string;
      nameOnCard?: string;
      cardNumber?: string;
      expiryDate?: string;
      cvv?: string;
      upiId?: string;
    } = {};

    if (!paymentMethod) {
      newErrors.paymentMethod = "Please select a payment method.";
    }

    if (paymentMethod === "card") {
      if (!cardDetails.nameOnCard) {
        newErrors.nameOnCard = "Name on Card is required.";
      }
      if (!cardDetails.cardNumber || !/^[0-9]{16}$/.test(cardDetails.cardNumber.replace(/\s/g, ""))) {
        newErrors.cardNumber = "Valid 16-digit Card Number is required.";
      }
      if (!cardDetails.expiryDate || !/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(cardDetails.expiryDate)) {
        newErrors.expiryDate = "Valid Expiry Date (MM/YY) is required.";
      }
      if (!cardDetails.cvv || !/^[0-9]{3,4}$/.test(cardDetails.cvv)) {
        newErrors.cvv = "Valid 3 or 4-digit CVV is required.";
      }
    } else if (paymentMethod === "upi") {
      if (!upiId) {
        newErrors.upiId = "UPI ID is required.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required payment details correctly.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate payment processing (Stripe/Razorpay integration would go here)
      console.log("Processing payment for plan:", selectedPlan.name);
      console.log("Billing Cycle:", billingCycle);
      console.log("Payment method:", paymentMethod);
      if (paymentMethod === "card") {
        console.log("Card details:", cardDetails);
      } else if (paymentMethod === "upi") {
        console.log("UPI ID:", upiId);
      }
      console.log("Billing Address:", billingAddress);

      // Simulate API call to create subscription
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assuming success, update form data with payment details
      const paymentDetails: PaymentDetails = {
        method: paymentMethod,
        cardDetails: paymentMethod === "card" ? cardDetails : null,
        upiId: paymentMethod === "upi" ? upiId : null,
        billingAddress,
        subscriptionId: "sub_mock123", // Replace with actual subscription ID from payment gateway
      };

      toast({
        title: "Payment Successful",
        description: "Your organization is now registered!",
      });

      onNext(paymentDetails);
    } catch (error) {
      console.error("Payment failed:", error);
      toast({
        title: "Payment Failed",
        description: "There was an issue processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestPayment = () => {
    // Populate with dummy data for testing
    setPaymentMethod("card");
    setCardDetails({
      nameOnCard: "Test User",
      cardNumber: "4242424242424242",
      expiryDate: "12/25",
      cvv: "123",
    });
    setBillingAddress("123 Test St, Test City");
    toast({
      title: "Test Payment Data Loaded",
      description: "Dummy card data has been pre-filled.",
    });
  };

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6">
          <Progress value={80} className="w-full" />{" "}
          {/* Assuming 80% for Step 4 of 5 */}
          <p className="text-sm text-muted-foreground mt-2">Step 4 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Secure Payment
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label className="mb-2 block">Select Payment Method</Label>
            <RadioGroup
              onValueChange={(value: "card" | "upi") => {
                setPaymentMethod(value);
                setErrors((prev) => ({ ...prev, paymentMethod: undefined }));
              }}
              value={paymentMethod}
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
            {errors.paymentMethod && (
              <p className="text-destructive text-sm mt-1">
                {errors.paymentMethod}
              </p>
            )}
          </div>

          {paymentMethod === "card" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="nameOnCard" className="mb-2 block">
                  Name on Card <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nameOnCard"
                  type="text"
                  placeholder="Full Name on Card"
                  value={cardDetails.nameOnCard}
                  onChange={handleCardChange}
                  className={cn(errors.nameOnCard && "border-destructive")}
                />
                {errors.nameOnCard && (
                  <p className="text-destructive text-sm mt-1">
                    {errors.nameOnCard}
                  </p>
                )}
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
                    value={cardDetails.cardNumber
                      .replace(/\s/g, "")
                      .replace(/(\d{4})/g, "$1 ")
                      .trim()}
                    onChange={handleCardChange}
                    maxLength={19} // 16 digits + 3 spaces
                    className={cn("pl-10", errors.cardNumber && "border-destructive")}
                  />
                </div>
                {errors.cardNumber && (
                  <p className="text-destructive text-sm mt-1">
                    {errors.cardNumber}
                  </p>
                )}
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
                      value={cardDetails.expiryDate
                        .replace(/[^0-9]/g, "")
                        .replace(/^(\d{2})/, "$1/")
                        .slice(0, 5)}
                      onChange={handleCardChange}
                      maxLength={5} // MM/YY
                      className={cn("pl-10", errors.expiryDate && "border-destructive")}
                    />
                  </div>
                  {errors.expiryDate && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.expiryDate}
                    </p>
                  )}
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
                      value={cardDetails.cvv}
                      onChange={handleCardChange}
                      maxLength={4}
                      className={cn("pl-10", errors.cvv && "border-destructive")}
                    />
                  </div>
                  {errors.cvv && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.cvv}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {paymentMethod === "upi" && (
            <div>
              <Label htmlFor="upiId" className="mb-2 block">
                UPI ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upiId"
                type="text"
                placeholder="yourname@bankupi"
                value={upiId}
                onChange={(e) => {
                  setUpiId(e.target.value);
                  setErrors((prev) => ({ ...prev, upiId: undefined }));
                }}
                className={cn(errors.upiId && "border-destructive")}
              />
              {errors.upiId && (
                <p className="text-destructive text-sm mt-1">
                  {errors.upiId}
                </p>
              )}
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
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 mr-2 text-green-500" /> 🔒 100% Secure
          </div>

          <Button type="submit" className="w-full py-3 text-lg" disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Pay & Register Organization"}
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
        </form>

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

    