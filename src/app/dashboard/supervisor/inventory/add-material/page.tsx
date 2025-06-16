
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, RefreshCw, Package, Landmark, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { addMaterialToInventory, AddInventoryItemInput, AddMaterialResult } from '@/app/actions/inventory-expense/addMaterialToInventory';
import { fetchSupervisorAssignedProjects, FetchSupervisorProjectsResult } from '@/app/actions/supervisor/fetchSupervisorData'; 
import type { ProjectForSelection } from '@/app/actions/common/fetchAllProjects'; 

type UnitType = 'kg' | 'pcs' | 'm' | 'liters' | 'custom';
const unitOptions: UnitType[] = ['kg', 'pcs', 'm', 'liters', 'custom'];

export default function AddMaterialPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number | string>('');
  const [unit, setUnit] = useState<UnitType>('pcs');
  const [costPerUnit, setCostPerUnit] = useState<number | string>('');
  const [customUnitLabel, setCustomUnitLabel] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  const loadProjectsList = useCallback(async () => {
    if (!user?.id) return;
    setLoadingProjects(true);
    try {
      // Admins will see all projects for adding material, supervisors only their assigned ones
      const result: FetchSupervisorProjectsResult = user.role === 'admin' 
          ? await fetchAllProjects() // Assuming fetchAllProjects has same return type for projects list
          : await fetchSupervisorAssignedProjects(user.id);

      if (result.success && result.projects) {
        setProjects(result.projects);
      } else {
        setProjects([]);
        console.error("Failed to fetch projects:", result.error);
        toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast({ title: "Error", description: "Could not load projects.", variant: "destructive" });
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [toast, user?.id, user?.role]); // Added user.role

  useEffect(() => {
    if (!authLoading && user?.id) {
        loadProjectsList();
    }
  }, [loadProjectsList, authLoading, user?.id]);

  const resetForm = () => {
    setSelectedProjectId('');
    setItemName('');
    setQuantity('');
    setUnit('pcs');
    setCostPerUnit('');
    setCustomUnitLabel('');
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!user || (!user.id && !authLoading)) {
      toast({ title: "Authentication Error", description: "User not authenticated. Please log in.", variant: "destructive" });
      return;
    }
    if (!user.id && authLoading) {
        toast({ title: "Authenticating", description: "Please wait, user session is loading.", variant: "default" });
        return;
    }
     if (!user.id) {
        toast({ title: "Authentication Error", description: "User ID missing after auth check.", variant: "destructive" });
        return;
    }


    const parsedQuantity = parseFloat(String(quantity));
    const parsedCostPerUnit = parseFloat(String(costPerUnit));

    let currentErrors: Record<string, string | undefined> = {};
    if (!selectedProjectId) currentErrors.projectId = "Project is required.";
    if (!itemName) currentErrors.itemName = "Item name is required.";
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) currentErrors.quantity = "Quantity must be a positive number.";
    if (unit === 'custom' && !customUnitLabel.trim()) currentErrors.customUnitLabel = "Custom unit label is required for 'custom' unit.";
    if (isNaN(parsedCostPerUnit) || parsedCostPerUnit < 0) currentErrors.costPerUnit = "Cost per unit must be a non-negative number.";

    if (Object.keys(currentErrors).length > 0) {
        setFormErrors(currentErrors);
        toast({ title: "Validation Error", description: "Please check the form for errors.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);

    const inventoryInput: AddInventoryItemInput = {
      projectId: selectedProjectId,
      itemName,
      quantity: parsedQuantity,
      unit,
      costPerUnit: parsedCostPerUnit,
      ...(unit === 'custom' && { customUnitLabel }),
    };

    const result: AddMaterialResult = await addMaterialToInventory(user.id, inventoryInput);

    if (result.success) {
      toast({
        title: "Material Added!",
        description: `${itemName} added to project inventory successfully. Item ID: ${result.inventoryItemId}`,
      });
      resetForm();
    } else {
      if (result.errors) {
        const newErrors: Record<string, string | undefined> = {};
        result.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
        setFormErrors(newErrors);
      }
      toast({
        title: "Failed to Add Material",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  if (authLoading) {
    return <div className="p-4">Loading user...</div>;
  }

  // Access Guard: Only admin can access this page
  if (!user || user.role !== 'admin') {
     return (
        <div className="p-4">
            <PageHeader title="Access Denied" description="Only administrators can add material to inventory."/>
            <Card className="mt-4">
                <CardContent className="p-6 text-center">
                    <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
                    <p className="mt-2 font-semibold">Access Restricted</p>
                     <Button asChild variant="outline" className="mt-4">
                        <Link href="/dashboard">Go to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader title="Add Material to Project Inventory (Admin)" description="Fill in the details to add new material stock for a project." />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center"><Package className="mr-2 h-6 w-6 text-primary" />Material Details</CardTitle>
          <CardDescription>Enter information for the new inventory item.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="project">Project <span className="text-destructive">*</span></Label>
                <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Select
                        value={selectedProjectId}
                        onValueChange={setSelectedProjectId}
                        disabled={loadingProjects || projects.length === 0}
                    >
                        <SelectTrigger id="project" className="pl-10">
                        <SelectValue placeholder={loadingProjects ? "Loading projects..." : (projects.length === 0 ? "No projects available" : "Select a project")} />
                        </SelectTrigger>
                        <SelectContent>
                        {loadingProjects ? (
                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : projects.length > 0 ? (
                            projects.map(proj => (
                            <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                            ))
                        ) : (
                            <SelectItem value="no-projects" disabled>No projects available.</SelectItem>
                        )}
                        </SelectContent>
                    </Select>
                </div>
                {formErrors.projectId && <p className="text-sm text-destructive mt-1">{formErrors.projectId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemName">Item Name <span className="text-destructive">*</span></Label>
                <Input
                  id="itemName"
                  placeholder="e.g., Cement Bags, Copper Wire"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
                {formErrors.itemName && <p className="text-sm text-destructive mt-1">{formErrors.itemName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity <span className="text-destructive">*</span></Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="e.g., 100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.01"
                  step="0.01"
                />
                {formErrors.quantity && <p className="text-sm text-destructive mt-1">{formErrors.quantity}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit <span className="text-destructive">*</span></Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as UnitType)}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 {formErrors.unit && <p className="text-sm text-destructive mt-1">{formErrors.unit}</p>}
              </div>

              {unit === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="customUnitLabel">Custom Unit Label <span className="text-destructive">*</span></Label>
                  <Input
                    id="customUnitLabel"
                    placeholder="e.g., Pallet, Box"
                    value={customUnitLabel}
                    onChange={(e) => setCustomUnitLabel(e.target.value)}
                  />
                  {formErrors.customUnitLabel && <p className="text-sm text-destructive mt-1">{formErrors.customUnitLabel}</p>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="costPerUnit">Cost Per Unit (USD) <span className="text-destructive">*</span></Label>
              <Input
                id="costPerUnit"
                type="number"
                placeholder="e.g., 5.99"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                min="0"
                step="0.01"
              />
              {formErrors.costPerUnit && <p className="text-sm text-destructive mt-1">{formErrors.costPerUnit}</p>}
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || loadingProjects || !selectedProjectId}>
                {isSubmitting ? "Adding Material..." : <><PlusCircle className="mr-2 h-4 w-4" /> Add Material</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
