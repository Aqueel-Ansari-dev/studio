
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreHorizontal, RefreshCw, Edit, Trash2, Eye, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUsersForAdmin, type UserForAdminList, type FetchUsersForAdminResult } from '@/app/actions/admin/fetchUsersForAdmin';
import { updateUserByAdmin, deleteUserByAdmin, UserUpdateInput } from '@/app/actions/admin/manageUser';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';
import type { UserRole, PayMode } from '@/types/database';
import Link from 'next/link';

const USERS_PER_PAGE = 15;

export default function UserManagementPage() {
  const { user: adminUser } = useAuth();
  const [allLoadedUsers, setAllLoadedUsers] = useState<UserForAdminList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastVisibleCreatedAtISO, setLastVisibleCreatedAtISO] = useState<string | null | undefined>(undefined);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);

  const { toast } = useToast();

  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserForAdminList | null>(null);
  const [editFormState, setEditFormState] = useState<Partial<UserUpdateInput>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserForAdminList | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableRoles: UserRole[] = ['employee', 'supervisor', 'admin'];
  const availablePayModes: PayMode[] = ['hourly', 'daily', 'monthly', 'not_set'];

  const loadUsers = useCallback(async (loadMore = false) => {
    if (!adminUser?.id) {
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
    }

    const cursorToUse = loadMore ? lastVisibleCreatedAtISO : undefined;
    const currentHasMore = loadMore ? hasMoreUsers : true;

    if (!loadMore) {
      setIsLoading(true);
    } else {
      if (!currentHasMore || cursorToUse === null) {
        setIsLoadingMore(false);
        return;
      }
      setIsLoadingMore(true);
    }

    try {
      const result: FetchUsersForAdminResult = await fetchUsersForAdmin(
        USERS_PER_PAGE,
        cursorToUse
      );

      if (result.success && result.users) {
        if (loadMore) {
            setAllLoadedUsers(prev => {
              const existingIds = new Set(prev.map(u => u.id));
              const newUniqueUsers = result.users!.filter(u => !existingIds.has(u.id));
              return [...prev, ...newUniqueUsers];
            });
        } else {
            setAllLoadedUsers(result.users!);
        }
        setLastVisibleCreatedAtISO(result.lastVisibleCreatedAtISO);
        setHasMoreUsers(result.hasMore || false);
      } else {
        if (!loadMore) setAllLoadedUsers([]);
        setHasMoreUsers(false);
        toast({
          title: "Error Loading Users",
          description: result.error || "Could not load users.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      if (!loadMore) setAllLoadedUsers([]);
      setHasMoreUsers(false);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching users.",
        variant: "destructive",
      });
    } finally {
      if (!loadMore) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, [adminUser?.id, toast]);

  useEffect(() => {
    if (adminUser?.id) {
      loadUsers();
    }
  }, [adminUser?.id, loadUsers]);

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

  const formatRate = (rate?: number, payMode?: PayMode, role?: UserRole): string => {
    if (role !== 'employee' || payMode === 'not_set' || typeof rate !== 'number' || rate === 0) return 'N/A';
    return String(rate);
  };

  const handleEditUserClick = (userToEdit: UserForAdminList) => {
    setEditingUser(userToEdit);
    setEditFormState({
      displayName: userToEdit.displayName,
      role: userToEdit.role,
      payMode: userToEdit.payMode || 'not_set',
      rate: userToEdit.rate || 0,
    });
    setEditFormErrors({});
    setShowEditUserDialog(true);
  };

  const handleEditFormChange = (field: keyof UserUpdateInput, value: string | number | UserRole | PayMode) => {
    setEditFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleEditRoleChange = (newRole: UserRole) => {
    setEditFormState(prev => {
        const newState = { ...prev, role: newRole };
        if (newRole !== 'employee') {
            newState.payMode = 'not_set';
            newState.rate = 0;
        }
        return newState;
    });
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !adminUser) return;
    setIsSubmittingEdit(true);
    setEditFormErrors({});

    let rateToSubmit = editFormState.rate;
    if (editFormState.role === 'employee' && editFormState.payMode !== 'not_set') {
        rateToSubmit = parseFloat(String(editFormState.rate ?? 0));
        if (isNaN(rateToSubmit)) rateToSubmit = 0;
    } else {
        rateToSubmit = 0;
    }

    const updateData: UserUpdateInput = {
        displayName: editFormState.displayName || editingUser.displayName,
        role: editFormState.role || editingUser.role,
        payMode: editFormState.role === 'employee' ? (editFormState.payMode || 'not_set') : 'not_set',
        rate: rateToSubmit,
    };

    const result = await updateUserByAdmin(adminUser.id, editingUser.id, updateData);

    if (result.success) {
      toast({ title: "User Updated", description: result.message });
      setShowEditUserDialog(false);
      setEditingUser(null);
      loadUsers();
    } else {
      if (result.errors) {
        const newErrors: Record<string, string> = {};
        result.errors.forEach(err => {
          newErrors[err.path[0] as string] = err.message;
        });
        setEditFormErrors(newErrors);
      }
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
      loadUsers();
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setShowDeleteConfirmDialog(false);
    setDeletingUser(null);
    setIsDeleting(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="View, add, and manage user accounts and their roles within the system."
        actions={
          <>
            <Button variant="outline" onClick={() => loadUsers(false)} disabled={isLoading || isLoadingMore} className="mr-2">
              <RefreshCw className={`h-4 w-4 ${(isLoading || isLoadingMore) ? 'animate-spin' : ''} mr-2`} />
              Refresh
            </Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New User (Disabled)
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">User List</CardTitle>
          <CardDescription>
            {isLoading && allLoadedUsers.length === 0 ? "Loading users..." : `Displaying ${allLoadedUsers.length} user(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && allLoadedUsers.length === 0 ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading users...</p>
            </div>
          ) : allLoadedUsers.length === 0 && !isLoading ? (
            <p className="text-muted-foreground text-center py-10">No users found in the system.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Pay Mode</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allLoadedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} alt={user.displayName} data-ai-hint="user avatar" />
                          <AvatarFallback>{user.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.displayName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.role === 'employee' ? formatPayMode(user.payMode) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {formatRate(user.rate, user.payMode, user.role)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.createdAt), "PPp")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">User Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/admin/users/${user.id}`}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditUserClick(user)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit User
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteUserClick(user)}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              disabled={adminUser?.id === user.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete User Data
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hasMoreUsers && (
                <div className="mt-6 text-center">
                  <Button onClick={() => loadUsers(true)} disabled={isLoadingMore}>
                    {isLoadingMore ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ChevronDown className="mr-2 h-4 w-4"/>}
                    Load More Users
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {editingUser && (
        <Dialog open={showEditUserDialog} onOpenChange={(isOpen) => {
          if (!isOpen) setEditingUser(null);
          setShowEditUserDialog(isOpen);
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-headline">Edit User: {editingUser.displayName}</DialogTitle>
              <DialogDescription>Modify user details below. Email cannot be changed.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUserSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="editDisplayName">Display Name</Label>
                <Input
                  id="editDisplayName"
                  value={editFormState.displayName || ''}
                  onChange={(e) => handleEditFormChange('displayName', e.target.value)}
                  className="mt-1"
                />
                {editFormErrors.displayName && <p className="text-sm text-destructive mt-1">{editFormErrors.displayName}</p>}
              </div>
              <div>
                <Label htmlFor="editEmail">Email (Read-only)</Label>
                <Input id="editEmail" value={editingUser.email} readOnly className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="editRole">Role</Label>
                <Select
                  value={editFormState.role}
                  onValueChange={(value) => handleEditRoleChange(value as UserRole)}
                >
                  <SelectTrigger id="editRole" className="mt-1">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map(r => (
                      <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 {editFormErrors.role && <p className="text-sm text-destructive mt-1">{editFormErrors.role}</p>}
              </div>
              {editFormState.role === 'employee' && (
                <>
                  <div>
                    <Label htmlFor="editPayMode">Pay Mode</Label>
                    <Select
                      value={editFormState.payMode}
                      onValueChange={(value) => handleEditFormChange('payMode', value as PayMode)}
                    >
                      <SelectTrigger id="editPayMode" className="mt-1">
                        <SelectValue placeholder="Select pay mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePayModes.map(pm => (
                          <SelectItem key={pm} value={pm}>{formatPayMode(pm)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editFormErrors.payMode && <p className="text-sm text-destructive mt-1">{editFormErrors.payMode}</p>}
                  </div>
                  <div>
                    <Label htmlFor="editRate">Rate</Label>
                    <Input
                      id="editRate"
                      type="number"
                      value={editFormState.rate || 0}
                      onChange={(e) => handleEditFormChange('rate', e.target.value)}
                      className="mt-1"
                      min="0"
                      disabled={editFormState.payMode === 'not_set'}
                    />
                    {editFormErrors.rate && <p className="text-sm text-destructive mt-1">{editFormErrors.rate}</p>}
                  </div>
                </>
              )}
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={() => setShowEditUserDialog(false)} disabled={isSubmittingEdit}>Cancel</Button>
                 </DialogClose>
                <Button type="submit" disabled={isSubmittingEdit} className="bg-accent hover:bg-accent/90">
                  {isSubmittingEdit ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {deletingUser && (
        <AlertDialog open={showDeleteConfirmDialog} onOpenChange={(isOpen) => {
            if (!isOpen) setDeletingUser(null);
            setShowDeleteConfirmDialog(isOpen);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User: {deletingUser.displayName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the user's data from Firestore. It will NOT delete their Firebase Authentication account.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteConfirmDialog(false)} disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUserConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {isDeleting ? "Deleting..." : "Delete User Data"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
