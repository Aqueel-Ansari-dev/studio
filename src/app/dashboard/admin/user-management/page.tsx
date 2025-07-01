
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, MoreHorizontal, RefreshCw, Edit, Trash2, Eye, UserCheck, UserX, Search, ChevronDown, CheckCheck, XIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fetchUsersForAdmin, type UserForAdminList, type FetchUsersForAdminResult, type FetchUsersForAdminFilters } from '@/app/actions/admin/fetchUsersForAdmin';
import { updateUserByAdmin, deleteUserByAdmin, UserUpdateInput, bulkUpdateUsersStatus } from '@/app/actions/admin/manageUser';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';
import type { UserRole, PayMode } from '@/types/database';
import { UserDetailClientView } from '@/components/admin/user-detail-client-view';
import { fetchMyAssignedProjects } from '@/app/actions/employee/fetchEmployeeData';
import { fetchTasksForUserAdminView } from '@/app/actions/admin/fetchTasksForUserAdminView';
import { getLeaveRequests } from '@/app/actions/leave/leaveActions';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects';
import { Skeleton } from '@/components/ui/skeleton';

const USERS_PER_PAGE = 20; 
const TASKS_PER_PAGE = 10; 

export default function UserManagementPage() {
  const { user: adminUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserForAdminList[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  
  const [lastVisibleCursor, setLastVisibleCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [filters, setFilters] = useState<FetchUsersForAdminFilters>({ searchTerm: '', role: 'all', status: 'all' });
  const searchDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);


  const { toast } = useToast();

  const [showEditUserSheet, setShowEditUserSheet] = useState(false);
  const [editingUser, setEditingUser] = useState<UserForAdminList | null>(null);
  const [editFormState, setEditFormState] = useState<Partial<UserUpdateInput>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserForAdminList | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<UserForAdminList | null>(null);
  
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);
  const [isProcessingBulkAction, setIsProcessingBulkAction] = useState(false);


  const availableRoles: UserRole[] = ['employee', 'supervisor', 'admin'];
  const availablePayModes: PayMode[] = ['hourly', 'daily', 'monthly', 'not_set'];

  const loadUsers = useCallback(async (loadMore = false) => {
    if (!adminUser?.id) return;
    if (loadMore && !hasMore) return;
    
    if (loadMore) {
        setIsLoadingMore(true);
    } else {
        setIsFetching(true);
        setSelectedUserIds([]);
    }

    try {
      const result: FetchUsersForAdminResult = await fetchUsersForAdmin(
        adminUser.id,
        USERS_PER_PAGE,
        loadMore ? lastVisibleCursor : null,
        filters
      );

      if (result.success && result.users) {
        setUsers(prev => loadMore ? [...prev, ...result.users!] : result.users!);
        setHasMore(result.hasMore || false);
        setLastVisibleCursor(result.lastVisibleValue || null);
      } else {
        if (!loadMore) setUsers([]);
        setHasMore(false);
      }
    } catch (error) {
        toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      if (loadMore) setIsLoadingMore(false); else setIsFetching(false);
    }
  }, [adminUser?.id, hasMore, lastVisibleCursor, filters, toast]); 

  useEffect(() => {
    if (adminUser?.id && !authLoading) {
      loadUsers(false); 
    }
  }, [adminUser?.id, authLoading, loadUsers]); 

  const handleFilterChange = (filterType: keyof FetchUsersForAdminFilters, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    if(filterType !== 'searchTerm') {
      loadUsers(false);
    }
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    handleFilterChange('searchTerm', newSearchTerm);

    if (searchDebounceTimeoutRef.current) {
      clearTimeout(searchDebounceTimeoutRef.current);
    }
    searchDebounceTimeoutRef.current = setTimeout(() => {
      loadUsers(false);
    }, 500);
  };
  
  const handleSelectUser = (userId: string, isSelected: boolean) => {
    setSelectedUserIds(prev => isSelected ? [...prev, userId] : prev.filter(id => id !== userId));
  }

  const handleSelectAll = (isSelected: boolean) => {
    setSelectedUserIds(isSelected ? users.map(u => u.id) : []);
  }
  
  const handleViewDetails = (user: UserForAdminList) => {
    setSelectedUserForDrawer(user);
    setIsDrawerOpen(true);
  };
  
  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'supervisor': return 'secondary';
      case 'employee': default: return 'outline';
    }
  };
  
  const formatPayMode = (payMode?: PayMode): string => {
    if (!payMode || payMode === 'not_set') return 'Not Set';
    return payMode.charAt(0).toUpperCase() + payMode.slice(1);
  };

  const handleEditUserClick = (userToEdit: UserForAdminList) => {
    setEditingUser(userToEdit);
    setEditFormState({ displayName: userToEdit.displayName, role: userToEdit.role, payMode: userToEdit.payMode || 'not_set', rate: userToEdit.rate || 0, isActive: userToEdit.isActive === undefined ? true : userToEdit.isActive });
    setEditFormErrors({});
    setShowEditUserSheet(true);
  };

  const handleEditFormChange = (field: keyof UserUpdateInput, value: string | number | boolean | UserRole | PayMode) => {
    setEditFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleEditRoleChange = (newRole: UserRole) => {
    setEditFormState(prev => ({ ...prev, role: newRole, payMode: newRole === 'employee' ? (prev.payMode || 'not_set') : 'not_set', rate: newRole === 'employee' ? prev.rate : 0 }));
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !adminUser) return;
    setIsSubmittingEdit(true);
    const result = await updateUserByAdmin(adminUser.id, editingUser.id, editFormState as UserUpdateInput);
    if (result.success) {
      toast({ title: "User Updated", description: result.message });
      setShowEditUserSheet(false);
      setEditingUser(null);
      loadUsers(false);
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmittingEdit(false);
  };
  
  const handleDeleteUserClick = (userToDelete: UserForAdminList) => {
    setDeletingUser(userToDelete);
    setShowDeleteConfirmDialog(true);
  };

  const handleDeleteUserConfirm = async () => {
    if (!deletingUser || !adminUser) return;
    setIsDeleting(true);
    const result = await deleteUserByAdmin(adminUser.id, deletingUser.id);
    if (result.success) {
      toast({ title: "User Deleted", description: result.message });
      loadUsers(false);
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setShowDeleteConfirmDialog(false);
    setDeletingUser(null);
    setIsDeleting(false);
  };

  const handleBulkActionClick = (action: 'activate' | 'deactivate') => {
    setBulkAction(action);
    setShowBulkConfirm(true);
  };

  const handleConfirmBulkAction = async () => {
    if (!adminUser || !bulkAction || selectedUserIds.length === 0) return;
    setIsProcessingBulkAction(true);
    const isActive = bulkAction === 'activate';
    const result = await bulkUpdateUsersStatus(adminUser.id, selectedUserIds, isActive);
    if (result.success) {
      toast({ title: 'Bulk Action Successful', description: result.message });
      loadUsers(false);
    } else {
      toast({ title: 'Bulk Action Failed', description: result.message, variant: 'destructive' });
    }
    setShowBulkConfirm(false);
    setBulkAction(null);
    setIsProcessingBulkAction(false);
    setSelectedUserIds([]);
  };

  
  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="View, add, and manage user accounts and their roles."/>
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search by name..." value={filters.searchTerm || ''} onChange={handleSearchChange} className="pl-10"/>
            </div>
            <div className="flex flex-wrap gap-2">
                <Select value={filters.role} onValueChange={(v) => handleFilterChange('role', v)}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Roles</SelectItem>{availableRoles.map(r => (<SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>))}</SelectContent>
                </Select>
                <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
                 <Button onClick={() => loadUsers(false)} variant="outline" size="icon" disabled={isFetching}><RefreshCw className="h-4 w-4" /></Button>
            </div>
        </CardHeader>
        <CardContent>
           {selectedUserIds.length > 0 && (
                <div className="p-3 bg-muted rounded-md mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium">{selectedUserIds.length} user(s) selected</p>
                    <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleBulkActionClick('activate')}><UserCheck className="mr-2 h-4 w-4"/>Activate</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleBulkActionClick('deactivate')}><UserX className="mr-2 h-4 w-4"/>Deactivate</Button>
                    </div>
                </div>
            )}
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox onCheckedChange={handleSelectAll} checked={selectedUserIds.length > 0 && selectedUserIds.length === users.length} /></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Pay Info</TableHead>
                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetching && users.length === 0 ? (
                    [...Array(10)].map((_, i) => (<TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full" /></TableCell></TableRow>))
                  ) : users.map((user) => (
                    <TableRow key={user.id} data-state={selectedUserIds.includes(user.id) ? "selected" : ""}>
                      <TableCell><Checkbox onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)} checked={selectedUserIds.includes(user.id)}/></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar><AvatarImage src={user.avatarUrl} alt={user.displayName} data-ai-hint="user avatar" /><AvatarFallback>{user.displayName.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                          <div><p className="font-medium">{user.displayName}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge></TableCell>
                      <TableCell><Badge variant={user.isActive === false ? "destructive" : "outline"} className={user.isActive !== false ? "border-emerald-500 text-emerald-600" : ""}>{user.isActive === false ? 'Inactive' : 'Active'}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{user.role === 'employee' ? `${formatPayMode(user.payMode)} / $${user.rate}` : 'N/A'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{format(new Date(user.createdAt), "PP")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleViewDetails(user)}><Eye className="mr-2 h-4 w-4"/>View Details</DropdownMenuItem><DropdownMenuItem onClick={() => handleEditUserClick(user)}><Edit className="mr-2 h-4 w-4"/>Edit User</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleDeleteUserClick(user)} disabled={adminUser?.id === user.id} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4"/>Delete User</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
          {!isFetching && users.length === 0 && (<p className="text-center py-10 text-muted-foreground">No users match filters.</p>)}
          {hasMore && (<div className="mt-6 text-center"><Button onClick={() => loadUsers(true)} disabled={isLoadingMore}>{isLoadingMore ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ChevronDown className="mr-2 h-4 w-4"/>} Load More</Button></div>)}
        </CardContent>
      </Card>
      
      {editingUser && (<Sheet open={showEditUserSheet} onOpenChange={(isOpen) => {if (!isOpen) setEditingUser(null); setShowEditUserSheet(isOpen);}}><SheetContent><SheetHeader><SheetTitle>Edit User: {editingUser.displayName}</SheetTitle><SheetDescription>Modify user details below.</SheetDescription></SheetHeader><form onSubmit={handleEditUserSubmit} className="space-y-4 py-4"><div><Label htmlFor="editDisplayName">Display Name</Label><Input id="editDisplayName" value={editFormState.displayName || ''} onChange={(e) => handleEditFormChange('displayName', e.target.value)}/></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="editRole">Role</Label><Select value={editFormState.role} onValueChange={(value) => handleEditRoleChange(value as UserRole)}><SelectTrigger id="editRole"><SelectValue/></SelectTrigger><SelectContent>{availableRoles.map(r => (<SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>))}</SelectContent></Select></div><div><Label>Account Status</Label><div className="flex items-center space-x-2 pt-2"><Switch id="editIsActive" checked={editFormState.isActive} onCheckedChange={(checked) => handleEditFormChange('isActive', checked)} disabled={adminUser?.id === editingUser.id}/><span>{editFormState.isActive ? 'Active' : 'Inactive'}</span></div></div></div>{editFormState.role === 'employee' && (<div className="grid grid-cols-2 gap-4"><div><Label htmlFor="editPayMode">Pay Mode</Label><Select value={editFormState.payMode} onValueChange={(value) => handleEditFormChange('payMode', value as PayMode)}><SelectTrigger id="editPayMode"><SelectValue/></SelectTrigger><SelectContent>{availablePayModes.map(pm => (<SelectItem key={pm} value={pm}>{formatPayMode(pm)}</SelectItem>))}</SelectContent></Select></div><div><Label htmlFor="editRate">Rate</Label><Input id="editRate" type="number" value={String(editFormState.rate ?? 0)} onChange={(e) => handleEditFormChange('rate', e.target.valueAsNumber)} min="0" step="0.01" disabled={editFormState.payMode === 'not_set'}/></div></div>)}<div className="pt-6 flex justify-end gap-2"><SheetClose asChild><Button type="button" variant="outline">Cancel</Button></SheetClose><Button type="submit" disabled={isSubmittingEdit}>{isSubmittingEdit ? "Saving..." : "Save Changes"}</Button></div></form></SheetContent></Sheet>)}
      {deletingUser && (<AlertDialog open={showDeleteConfirmDialog} onOpenChange={(isOpen) => {if (!isOpen) setDeletingUser(null); setShowDeleteConfirmDialog(isOpen);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete User: {deletingUser.displayName}?</AlertDialogTitle><AlertDialogDescription>This will delete user data from Firestore but not their Auth account. This is usually not reversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUserConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isDeleting ? "Deleting..." : "Delete User Data"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
      {bulkAction && (<AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle><AlertDialogDescription>You are about to {bulkAction} {selectedUserIds.length} user(s). Are you sure?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmBulkAction} className={bulkAction === 'deactivate' ? "bg-destructive hover:bg-destructive/90" : ""} disabled={isProcessingBulkAction}>{isProcessingBulkAction ? 'Processing...' : `Yes, ${bulkAction}`}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>)}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}><UserDetailDrawerContent user={selectedUserForDrawer}/></Sheet>
    </div>
  );
}

function UserDetailDrawerContent({ user }: { user: UserForAdminList | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      const [projects, tasks, leaves, allProjectsList] = await Promise.all([fetchMyAssignedProjects(user.id),fetchTasksForUserAdminView(user.id, TASKS_PER_PAGE),getLeaveRequests(user.id),fetchAllProjects()]);
      setData({assignedProjects: projects.projects || [],initialTasks: tasks.tasks || [],initialHasMoreTasks: tasks.hasMore || false,initialLastTaskCursor: tasks.lastVisibleTaskTimestamps || null,leaveRequests: !('error' in leaves) ? leaves : [],allProjects: allProjectsList.projects || []});
      setLoading(false);
    }
    if (user) fetchData();
  }, [user]);

  if (!user) return null;
  return (<SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0"><SheetHeader className="p-6 pb-4 border-b"><SheetTitle>{`User Details: ${user.displayName}`}</SheetTitle><SheetDescription>{`Detailed activity log for ${user.email}`}</SheetDescription></SheetHeader><div className="h-[calc(100vh-80px)] overflow-y-auto p-6">{loading || !data ? (<div className="space-y-6"><div className="flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-full" /><div className="space-y-2 flex-grow"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></div></div><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>) : (<UserDetailClientView userDetails={user} assignedProjects={data.assignedProjects} initialTasks={data.initialTasks} initialHasMoreTasks={data.initialHasMoreTasks} initialLastTaskCursor={data.initialLastTaskCursor} leaveRequests={data.leaveRequests} allProjects={data.allProjects}/>)}</div></SheetContent>);
}
