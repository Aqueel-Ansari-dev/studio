
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

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
  onDataChange: (data: {
    organizationName?: string;
    industryType?: IndustryType;
    organizationSize?: OrganizationSize;
  }) => void;
  organizationName: string;
  industryType: IndustryType;
  organizationSize: OrganizationSize;
}

const OrganizationInfoStep: React.FC<OrganizationInfoStepProps> = ({
  onDataChange,
  organizationName,
  industryType,
  organizationSize,
}) => {
  // Removed internal state and useEffects to make this a controlled component

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
          <Progress value={20} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">Step 1 of 5</p>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">
          Organization Details
        </h2>

        <div className="space-y-6">
          <div>
            <Label htmlFor="organizationName" className="mb-2 block">
              Organization Name
            </Label>
            <Input
              id="organizationName"
              type="text"
              placeholder="Your Organization Name"
              value={organizationName}
              onChange={(e) =>
                onDataChange({ organizationName: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="industryType" className="mb-2 block">
              Industry Type
            </Label>
            <Select
              onValueChange={(value: IndustryType) =>
                onDataChange({ industryType: value })
              }
              value={industryType}
            >
              <SelectTrigger>
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
          </div>

          <div>
            <Label htmlFor="organizationSize" className="mb-2 block">
              Organization Size
            </Label>
            <Select
              onValueChange={(value: OrganizationSize) =>
                onDataChange({ organizationSize: value })
              }
              value={organizationSize}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1-10</SelectItem>
                <SelectItem value="11-50">11-50</SelectItem>
                <SelectItem value="51-200">51-200</SelectItem>
                <SelectItem value="200+">200+</SelectItem>
              </SelectContent>
            </Select>
            {organizationSize && (
              <p className="text-sm text-muted-foreground mt-2">
                {getPlanSuggestion()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationInfoStep;
