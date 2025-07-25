
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, RefreshCw, PackageOpen, Archive, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchSupervisorAssignedProjects, FetchSupervisorProjectsResult } from '@/app/actions/supervisor/fetchSupervisorData'; 
import type { ProjectForSelection } from '@/app/actions/common/fetchAllProjects'; 
import { getInventoryByProject, type ProjectInventoryDetails, type InventoryItemWithTotalCost } from '@/app/actions/inventory-expense/getInventoryByProject';

interface ProjectWithInventory extends ProjectForSelection {
  inventoryDetails: ProjectInventoryDetails | null;
  fetchError?: string;
}

export default function SupervisorInventoryOverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [projectsWithInventory, setProjectsWithInventory] = useState<ProjectWithInventory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAllInventoryData = useCallback(async () => {
    if (!user || !user.id || user.role !== 'admin') { // Changed: Only admin can access
      if (!authLoading) {
        toast({ title: "Unauthorized", description: "You do not have permission to view this page.", variant: "destructive" });
        setIsLoading(false);
      }
      return;
    }
    setIsLoading(true);
    try {
      // Admins should probably see all projects or have a different fetch action.
      // For now, using supervisor assigned projects, assuming admin might also be supervisor.
      // This needs a proper admin-specific "fetch all projects with inventory" if general admin view is desired.
      const supervisorProjectsResult: FetchSupervisorProjectsResult = await fetchSupervisorAssignedProjects(user.id); 
      const projectsToIterate = supervisorProjectsResult.success && supervisorProjectsResult.projects ? supervisorProjectsResult.projects : [];

      if (projectsToIterate.length === 0) {
        setProjectsWithInventory([]);
        setIsLoading(false);
        if (!supervisorProjectsResult.success) {
            console.warn("Failed to fetch assigned projects list:", supervisorProjectsResult.error);
        }
        return;
      }

      const projectsData: ProjectWithInventory[] = [];
      for (const project of projectsToIterate) {
        const inventoryResult = await getInventoryByProject(project.id, user.id);
        if ('error' in inventoryResult) {
          projectsData.push({ ...project, inventoryDetails: null, fetchError: inventoryResult.error });
           console.warn(`Error fetching inventory for project ${project.name} (${project.id}): ${inventoryResult.error}`);
        } else {
          projectsData.push({ ...project, inventoryDetails: inventoryResult });
        }
      }
      setProjectsWithInventory(projectsData);

    } catch (error) {
      console.error("Failed to load inventory data:", error);
      toast({
        title: "Error Loading Inventory",
        description: "Could not load inventory data for your projects.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      loadAllInventoryData();
    }
  }, [loadAllInventoryData, authLoading, user]);

  const filteredProjects = useMemo(() => {
    return projectsWithInventory.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projectsWithInventory, searchTerm]);

  const formatCurrency = (amount: number | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (authLoading || (!user && isLoading)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Project Inventories" description="Loading inventory data..." />
        <Card><CardContent className="p-6 text-center"><RefreshCw className="mx-auto h-8 w-8 animate-spin" /></CardContent></Card>
      </div>
    );
  }

  // Access Guard: Only admin can access this page
  if (!user || user.role !== 'admin') {
    return (
        <div className="p-4">
            <PageHeader title="Access Denied" description="Only administrators can access project inventories."/>
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
      <PageHeader
        title="Project Inventories (Admin)"
        description="View inventory levels for projects. Use search to filter."
        actions={
          <div className="flex gap-2">
            <Button onClick={loadAllInventoryData} variant="outline" disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
            </Button>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/dashboard/supervisor/inventory/add-material">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Material
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <CardTitle className="font-headline">Project Inventories</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by project name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading inventory data...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Archive className="mx-auto h-12 w-12 mb-4" />
              <p className="font-semibold">
                {projectsWithInventory.length === 0 ? "No projects found with inventory." : "No projects match your search."}
              </p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {filteredProjects.map((project) => (
                <AccordionItem value={project.id} key={project.id}>
                  <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 rounded-md">
                    <div className="flex justify-between w-full items-center">
                        <span className="font-semibold text-lg">{project.name}</span>
                        {project.inventoryDetails && (
                             <Badge variant="secondary">
                                {project.inventoryDetails.items.length} item(s) - Total: {formatCurrency(project.inventoryDetails.totalInventoryCost)}
                             </Badge>
                        )}
                        {project.fetchError && <Badge variant="destructive">Error loading</Badge>}
                        {!project.inventoryDetails && !project.fetchError && <Badge variant="outline">No inventory</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4">
                    {project.fetchError ? (
                        <p className="text-destructive text-sm">Could not load inventory: {project.fetchError}</p>
                    ) : !project.inventoryDetails || project.inventoryDetails.items.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No inventory items recorded for this project.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead className="text-right">Cost/Unit</TableHead>
                            <TableHead className="text-right">Total Item Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {project.inventoryDetails.items.map((item: InventoryItemWithTotalCost) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.itemName}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell>{item.unit === 'custom' && item.customUnitLabel ? item.customUnitLabel : item.unit.toUpperCase()}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.costPerUnit)}</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(item.totalItemCost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
