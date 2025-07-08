
"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils"; // Assuming a utility for class names
import { Eye, EyeOff } from "lucide-react"; // Assuming lucide-react for icons

interface AdminAccountStepProps {
  onNext: (data: {
    fullName: string;
    workEmail: string;
    phoneNumber: string;
    passwordUser: string;
  }) => void;
}

type PasswordStrength = "Weak" | "Medium" | "Strong" | "";

const AdminAccountStep: React.FC<AdminAccountStepProps> = ({ onNext }) => {
  const [fullName, setFullName] = useState<string>("");
  const [workEmail, setWorkEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [passwordUser, setPasswordUser] = useState<string>("");
  const [termsAgreed, setTermsAgreed] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    workEmail?: string;
    phoneNumber?: string;
    passwordUser?: string;
    termsAgreed?: string;
  }>({});

  const validatePassword = (password: string): PasswordStrength => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[0-9]/.test(password)) strength++; // Contains a number
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++; // Contains a symbol

    if (strength === 3) return "Strong";
    if (strength === 2) return "Medium";
    if (strength === 1) return "Weak";
    return "";
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPasswordUser(newPassword);
    setPasswordStrength(validatePassword(newPassword));
    setErrors((prev) => ({ ...prev, passwordUser: undefined }));
  };

  const validateForm = () => {
    const newErrors: {
      fullName?: string;
      workEmail?: string;
      phoneNumber?: string;
      passwordUser?: string;
      termsAgreed?: string;
    } = {};

    if (!fullName) {
      newErrors.fullName = "Full Name is required.";
    }
    if (!workEmail) {
      newErrors.workEmail = "Work Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(workEmail)) {
      newErrors.workEmail = "Invalid email format.";
    }
    if (!phoneNumber) {
      newErrors.phoneNumber = "Phone Number is required.";
    }
    if (!passwordUser) {
      newErrors.passwordUser = "Password is required.";
    } else if (validatePassword(passwordUser) !== "Strong") {
      newErrors.passwordUser =
        "Password must be strong (at least 8 chars, number, symbol).";
    }
    if (!termsAgreed) {
      newErrors.termsAgreed = "You must agree to the terms and privacy policy.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext({ fullName, workEmail, phoneNumber, passwordUser });
    }
  };

  const getPasswordStrengthColor = (strength: PasswordStrength) => {
    switch (strength) {
      case "Weak":
        return "text-destructive";
      case "Medium":
        return "text-orange-500";
      case "Strong":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getPasswordStrengthProgress = (strength: PasswordStrength) => {
    switch (strength) {
      case "Weak":
        return 33;
      case "Medium":
        return 66;
      case "Strong":
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6">
          <Progress value={40} className="w-full" />{" "}
          {/* Assuming 40% for Step 2 of 5 */}
          <p className="text-sm text-muted-foreground mt-2">Step 2 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Admin Account Setup
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="fullName" className="mb-2 block">
              Full Name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              className={cn(errors.fullName && "border-destructive")}
            />
            {errors.fullName && (
              <p className="text-destructive text-sm mt-1">
                {errors.fullName}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="workEmail" className="mb-2 block">
              Work Email
            </Label>
            <Input
              id="workEmail"
              type="email"
              placeholder="your@example.com"
              value={workEmail}
              onChange={(e) => {
                setWorkEmail(e.target.value);
                setErrors((prev) => ({ ...prev, workEmail: undefined }));
              }}
              className={cn(errors.workEmail && "border-destructive")}
            />
            {errors.workEmail && (
              <p className="text-destructive text-sm mt-1">
                {errors.workEmail}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="phoneNumber" className="mb-2 block">
              Phone Number
            </Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="e.g., +1234567890"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
              }}
              className={cn(errors.phoneNumber && "border-destructive")}
            />
            {errors.phoneNumber && (
              <p className="text-destructive text-sm mt-1">
                {errors.phoneNumber}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="passwordUser" className="mb-2 block">
              Password
            </Label>
            <div className="relative">
              <Input
                id="passwordUser"
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={passwordUser}
                onChange={handlePasswordChange}
                className={cn(errors.passwordUser && "border-destructive")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {passwordUser && (
              <div className="mt-2">
                <Progress
                  value={getPasswordStrengthProgress(passwordStrength)}
                  className="h-2"
                />
                <p
                  className={cn(
                    "text-sm mt-1",
                    getPasswordStrengthColor(passwordStrength)
                  )}
                >
                  Password Strength: {passwordStrength}
                </p>
              </div>
            )}
            {errors.passwordUser && (
              <p className="text-destructive text-sm mt-1">
                {errors.passwordUser}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={termsAgreed}
              onCheckedChange={(checked) => {
                setTermsAgreed(checked as boolean);
                setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
              }}
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I agree to the terms and privacy policy
            </label>
          </div>
          {errors.termsAgreed && (
            <p className="text-destructive text-sm mt-1">
              {errors.termsAgreed}
            </p>
          )}

          <Button type="submit" className="w-full py-3 text-lg">
            Continue to Plan Selection
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminAccountStep;
