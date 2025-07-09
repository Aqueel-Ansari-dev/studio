"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Search, Eye, Pause, Play, Mail } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { fetchAllOrganizations, OrganizationForOwnerList, updateOrganizationStatus } from '@/app/actions/owner/manageOrganizations';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

const ITEMS_PER_PAGE = 20;

export default function OrganizationManagerPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allOrgs, setAllOrgs] = useState<OrganizationForOwnerList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'monthly' | 'yearly'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'trial_expired'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const loadOrgs = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchAllOrganizations();
    if (result.success && result.organizations) {
      setAllOrgs(result.organizations);
    } else {
      toast({ title: 'Error', description: result.error || 'Could not fetch organizations.', variant: 'destructive' });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user?.role === 'owner') {
      loadOrgs();
    }
  }, [user, loadOrgs]);

  const filteredOrgs = useMemo(() => {
    let orgs = allOrgs;
    if (search.trim()) {
      const term = search.toLowerCase();
      orgs = orgs.filter(o => o.name.toLowerCase().includes(term) || o.adminEmail.toLowerCase().includes(term));
    }
    if (subscriptionFilter !== 'all') {
      orgs = orgs.filter(o => o.billingCycle === subscriptionFilter);
    }
    if (statusFilter !== 'all') {
      orgs = orgs.filter(o => (o.subscriptionStatus || 'active') === statusFilter);
    }
    return orgs;
  }, [allOrgs, search, subscriptionFilter, statusFilter]);

  const paginatedOrgs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrgs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrgs, currentPage]);

  const totalPages = Math.ceil(filteredOrgs.length / ITEMS_PER_PAGE);

  const handleSuspend = async (orgId: string) => {
    const res = await updateOrganizationStatus(orgId, 'paused');
    if (res.success) {
      toast({ title: 'Organization Updated', description: res.message });
      loadOrgs();
    } else {
      toast({ title: 'Error', description: res.message, variant: 'destructive' });
    }
  };

  const handleActivate = async (orgId: string) => {
    const res = await updateOrganizationStatus(orgId, 'active');
    if (res.success) {
      toast({ title: 'Organization Updated', description: res.message });
      loadOrgs();
    } else {
      toast({ title: 'Error', description: res.message, variant: 'destructive' });
    }
  };

  const exportCSV = () => {
    const headers = ['Name','Email','Plan','Status','Created'];
    const rows = filteredOrgs.map(o => [o.name, o.adminEmail, o.billingCycle || '', o.subscriptionStatus || '', o.createdAt]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'organizations.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (user?.role !== 'owner') {
    return <p>Access Denied.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Organizations" description="Manage all organizations registered on the platform." />
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={subscriptionFilter} onValueChange={v => { setSubscriptionFilter(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Subscription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="trial_expired">Trial Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV}>Export All</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Admin Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">No organizations found.</TableCell>
                  </TableRow>
                ) : (
                  paginatedOrgs.map(org => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{org.adminEmail}</TableCell>
                      <TableCell className="capitalize">{org.billingCycle || 'N/A'}</TableCell>
                      <TableCell className="capitalize">{org.subscriptionStatus || 'unknown'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{format(new Date(org.createdAt), 'PP')}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View Profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.location.href = `mailto:${org.adminEmail}` }><Mail className="mr-2 h-4 w-4" />Email Admin</DropdownMenuItem>
                            {org.subscriptionStatus === 'paused' ? (
                              <DropdownMenuItem onClick={() => handleActivate(org.id)}><Play className="mr-2 h-4 w-4" />Activate</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleSuspend(org.id)} className="text-destructive focus:text-destructive"><Pause className="mr-2 h-4 w-4" />Suspend</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {totalPages > 1 && (
          <Pagination className="p-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={() => setCurrentPage(p => Math.max(1, p-1))} />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>{currentPage}</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </Card>
    </div>
  );
}

