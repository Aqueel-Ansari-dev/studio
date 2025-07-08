
"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress"; // Assuming a Progress component exists or will be created
import { cn } from "@/lib/utils"; // Assuming a utility for class names

type IndustryType =
  | "Construction"
  | "Interior"
  | "Electrical"
  | "Civil"
  | "Fabrication"
  | "Other"
  | "";
type OrganizationSize = "1-10" | "11-50" | "51-200" | "200+" | "";

interface OrganizationInfoStepProps {
  onNext: (data: {
    organizationName: string;
    industryType: IndustryType;
    organizationSize: OrganizationSize;
  }) => void;
}

const OrganizationInfoStep: React.FC<OrganizationInfoStepProps> = ({
  onNext,
}) => {
  const [organizationName, setOrganizationName] = useState<string>("");
  const [industryType, setIndustryType] = useState<IndustryType>("");
  const [organizationSize, setOrganizationSize] =
    useState<OrganizationSize>("");
  const [errors, setErrors] = useState<{
    organizationName?: string;
    industryType?: string;
    organizationSize?: string;
  }>({});

  const validateForm = () => {
    const newErrors: {
      organizationName?: string;
      industryType?: string;
      organizationSize?: string;
    } = {};
    if (!organizationName) {
      newErrors.organizationName = "Organization Name is required.";
    }
    if (!industryType) {
      newErrors.industryType = "Industry Type is required.";
    }
    if (!organizationSize) {
      newErrors.organizationSize = "Organization Size is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext({ organizationName, industryType, organizationSize });
    }
  };

  const getPlanSuggestion = () => {
    switch (organizationSize) {
      case "1-10":
        return "Starter Plan is ideal for 1-10 users.";
      case "11-50":
        return "Pro Plan is ideal for 11-50 users.";
      case "51-200":
        return "Business Plan is ideal for 51-200 users.";
      case "200+":
        return "Enterprise Plan is ideal for 200+ users.";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-background text-foreground">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6">
          <Progress value={20} className="w-full" /> {/* Assuming 20% for Step 1 of 5 */}
          <p className="text-sm text-muted-foreground mt-2">Step 1 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Organization Details
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="organizationName" className="mb-2 block">
              Organization Name
            </Label>
            <Input
              id="organizationName"
              type="text"
              placeholder="Your Organization Name"
              value={organizationName}
              onChange={(e) => {
                setOrganizationName(e.target.value);
                setErrors((prev) => ({ ...prev, organizationName: undefined }));
              }}
              className={cn(errors.organizationName && "border-destructive")}
            />
            {errors.organizationName && (
              <p className="text-destructive text-sm mt-1">
                {errors.organizationName}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="industryType" className="mb-2 block">
              Industry Type
            </Label>
            <Select
              onValueChange={(value: IndustryType) => {
                setIndustryType(value);
                setErrors((prev) => ({ ...prev, industryType: undefined }));
              }}
              value={industryType}
            >
              <SelectTrigger
                className={cn(errors.industryType && "border-destructive")}
              >
                <SelectValue placeholder="Select Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Construction">Construction</SelectItem>
                <SelectItem value="Interior">Interior</SelectItem>
                <SelectItem value="Electrical">Electrical</SelectItem>
                <SelectItem value="Civil">Civil</SelectItem>
                <SelectItem value="Fabrication">Fabrication</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.industryType && (
              <p className="text-destructive text-sm mt-1">
                {errors.industryType}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="organizationSize" className="mb-2 block">
              Organization Size
            </Label>
            <Select
              onValueChange={(value: OrganizationSize) => {
                setOrganizationSize(value);
                setErrors((prev) => ({ ...prev, organizationSize: undefined }));
              }}
              value={organizationSize}
            >
              <SelectTrigger
                className={cn(errors.organizationSize && "border-destructive")}
              >
                <SelectValue placeholder="Select Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1-10</SelectItem>
                <SelectItem value="11-50">11-50</SelectItem>
                <SelectItem value="51-200">51-200</SelectItem>
                <SelectItem value="200+">200+</SelectItem>
              </SelectContent>
            </Select>
            {errors.organizationSize && (
              <p className="text-destructive text-sm mt-1">
                {errors.organizationSize}
              </p>
            )}
            {organizationSize && (
              <p className="text-sm text-muted-foreground mt-2">
                {getPlanSuggestion()}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full py-3 text-lg">
            Next Step
          </Button>
        </form>
      </div>
    </div>
  );
};

export default OrganizationInfoStep;
