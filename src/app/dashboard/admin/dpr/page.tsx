
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Eye, RefreshCw, Briefcase, User, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { fetchDprsForAdmin, type DPRForList, type FetchDprsFilters } from '@/app/actions/admin/fetchDprsForAdmin';
import { fetchUsersByRole, type UserForSelection } from '@/app/actions/common/fetchUsersByRole';
import { fetchAllProjects, type ProjectForSelection } from '@/app/actions/common/fetchAllProjects';
import { format } from 'date-fns';
import Image from 'next/image';

export default function DPRViewerPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [dprs, setDprs] = useState<DPRForList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [projects, setProjects] = useState<ProjectForSelection[]>([]);
  const [supervisors, setSupervisors] = useState<UserForSelection[]>([]);

  const [filters, setFilters] = useState<FetchDprsFilters>({});
  
  const [selectedDpr, setSelectedDpr] = useState<DPRForList | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const userMap = useMemo(() => {
    return new Map(supervisors.map(s => [s.id, s.name]));
  }, [supervisors]);

  const projectMap = useMemo(() => {
    return new Map(projects.map(p => [p.id, p.name]));
  }, [projects]);
  
  const loadLookups = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [projRes, supRes] = await Promise.all([
        fetchAllProjects(user.id),
        fetchUsersByRole(user.id, 'supervisor')
      ]);
      if(projRes.success) setProjects(projRes.projects || []);
      if(supRes.success) setSupervisors(supRes.users || []);
    } catch (e) {
      toast({title: "Error", description: "Could not load filter options."})
    }
  }, [user?.id, toast]);

  const loadDprs = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const result = await fetchDprsForAdmin(user.id, filters);
    if (result.success && result.dprs) {
      setDprs(result.dprs);
    } else {
      toast({ title: 'Error loading DPRs', description: result.error, variant: 'destructive' });
    }
    setIsLoading(false);
  }, [user?.id, filters, toast]);
  
  useEffect(() => {
    if (!authLoading && user) {
        loadLookups();
    }
  }, [authLoading, user, loadLookups]);

  useEffect(() => {
    if(!authLoading && user) {
        loadDprs();
    }
  }, [authLoading, user, loadDprs]);

  const handleFilterChange = (filterName: keyof FetchDprsFilters, value: any) => {
    // If user selects the "all" option, we want to remove the filter, otherwise set it
    const newFilters = { ...filters };
    if (value === 'all') {
      delete newFilters[filterName];
    } else {
      newFilters[filterName] = value;
    }
    setFilters(newFilters);
  };

  const handleViewDetails = (dpr: DPRForList) => {
    setSelectedDpr(dpr);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Progress Reports" description="View all submitted DPRs from supervisors." />
      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <Select value={filters.projectId || 'all'} onValueChange={(v) => handleFilterChange('projectId', v)}>
                <SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
             <Select value={filters.supervisorId || 'all'} onValueChange={(v) => handleFilterChange('supervisorId', v)}>
                <SelectTrigger><SelectValue placeholder="All Supervisors" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Supervisors</SelectItem>
                    {supervisors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Popover><PopoverTrigger asChild><Button variant="outline" className="justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{filters.startDate ? format(filters.startDate, "PPP") : <span>Start Date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filters.startDate} onSelect={(d) => handleFilterChange('startDate', d)} /></PopoverContent></Popover>
            <Popover><PopoverTrigger asChild><Button variant="outline" className="justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{filters.endDate ? format(filters.endDate, "PPP") : <span>End Date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filters.endDate} onSelect={(d) => handleFilterChange('endDate', d)} /></PopoverContent></Popover>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin"/></div>
          ) : dprs.length === 0 ? (
            <p className="text-center text-muted-foreground">No DPRs found for the selected filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dprs.map(dpr => (
                  <TableRow key={dpr.id}>
                    <TableCell>{format(new Date(dpr.reportDate), 'PP')}</TableCell>
                    <TableCell>{projectMap.get(dpr.projectId) || 'N/A'}</TableCell>
                    <TableCell>{userMap.get(dpr.supervisorId) || 'N/A'}</TableCell>
                    <TableCell><Badge variant="secondary">{dpr.progressPercentage}%</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(dpr)}><Eye className="mr-2 h-4 w-4"/>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedDpr && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>DPR for {projectMap.get(selectedDpr.projectId)} - {format(new Date(selectedDpr.reportDate), 'PP')}</DialogTitle>
                    <DialogDescription>Submitted by {userMap.get(selectedDpr.supervisorId)}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div><Label>Progress</Label><p>{selectedDpr.progressPercentage}% complete</p></div>
                    <div><Label>Summary</Label><p className="text-sm p-2 border rounded-md bg-muted/50">{selectedDpr.summary}</p></div>
                    {selectedDpr.notes && <div><Label>Notes</Label><p className="text-sm p-2 border rounded-md bg-muted/50">{selectedDpr.notes}</p></div>}
                    {selectedDpr.issuesOrDelays && <div><Label>Issues/Delays</Label><p className="text-sm p-2 border rounded-md bg-muted/50">{selectedDpr.issuesOrDelays}</p></div>}
                    {selectedDpr.siteConditions && <div><Label>Site Conditions</Label><p className="text-sm p-2 border rounded-md bg-muted/50">{selectedDpr.siteConditions}</p></div>}
                    {selectedDpr.mediaUrls && selectedDpr.mediaUrls.length > 0 && (
                        <div>
                            <Label>Media Attachments</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                {selectedDpr.mediaUrls.map((url, idx) => (
                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                        <Image src={url} alt={`DPR Media ${idx+1}`} width={200} height={150} className="rounded-md object-cover w-full h-32" data-ai-hint="dpr photo" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
