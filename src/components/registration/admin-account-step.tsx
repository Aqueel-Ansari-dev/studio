
"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

interface AdminAccountStepProps {
  onDataChange: (data: Partial<{
    fullName: string;
    workEmail: string;
    phoneNumber: string;
    passwordUser: string;
    termsAgreed: boolean;
  }>) => void;
  fullName: string;
  workEmail: string;
  phoneNumber: string;
  passwordUser: string;
  termsAgreed: boolean;
}

type PasswordStrength = "Weak" | "Medium" | "Strong" | "";

const AdminAccountStep: React.FC<AdminAccountStepProps> = ({
  onDataChange,
  fullName,
  workEmail,
  phoneNumber,
  passwordUser,
  termsAgreed,
}) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>("");

  const validatePassword = (password: string): PasswordStrength => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

    if (strength === 3) return "Strong";
    if (strength === 2) return "Medium";
    if (strength === 1) return "Weak";
    return "";
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    onDataChange({ passwordUser: newPassword });
    setPasswordStrength(validatePassword(newPassword));
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
          <Progress value={40} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">Step 2 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Admin Account Setup
        </h2>

        <form className="space-y-6">
          <div>
            <Label htmlFor="fullName" className="mb-2 block">
              Full Name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => onDataChange({ fullName: e.target.value })}
            />
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
              onChange={(e) => onDataChange({ workEmail: e.target.value })}
            />
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
              onChange={(e) => onDataChange({ phoneNumber: e.target.value })}
            />
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
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={termsAgreed}
              onCheckedChange={(checked) => onDataChange({ termsAgreed: checked as boolean })}
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I agree to the terms and privacy policy
            </label>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminAccountStep;
