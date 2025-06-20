
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreHorizontal, RefreshCw, Edit, Trash2, Eye, UserCheck, UserX, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fetchUsersForAdmin, type UserForAdminList, type FetchUsersForAdminResult } from '@/app/actions/admin/fetchUsersForAdmin';
import { updateUserByAdmin, deleteUserByAdmin, UserUpdateInput } from '@/app/actions/admin/manageUser';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';
import type { UserRole, PayMode } from '@/types/database';
import Link from 'next/link';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const USERS_PER_PAGE = 10; 

export default function UserManagementPage() {
  const { user: adminUser } = useAuth();
  const [usersOnCurrentPage, setUsersOnCurrentPage] = useState<UserForAdminList[]>([]);
  const [isFetchingPageData, setIsFetchingPageData] = useState(true);
  
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  // Stores the cursor value (displayName or createdAt ISO) for the *last* item of page N, to fetch page N+1
  const [pageStartAfterCursors, setPageStartAfterCursors] = useState<Map<number, string | null>>(new Map([[0, null]])); 
  const [currentCursorField, setCurrentCursorField] = useState<'createdAt' | 'displayName'>('createdAt');
  const [hasNextPage, setHasNextPage] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const searchDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const loadUsersForPage = useCallback(async (targetPage: number, newSearchTerm?: string | null) => {
    if (!adminUser?.id) {
      setIsFetchingPageData(false);
      return;
    }
    setIsFetchingPageData(true);

    let effectiveSearchTerm = newSearchTerm === undefined ? searchTerm : newSearchTerm;
    let startAfterCursor: string | null = null;

    if (newSearchTerm !== undefined) { // New search initiated or search cleared
      setCurrentPageNumber(1);
      setPageStartAfterCursors(new Map([[0, null]]));
      startAfterCursor = null;
      targetPage = 1; // Reset to page 1 for new search
    } else if (targetPage > 1) {
      startAfterCursor = pageStartAfterCursors.get(targetPage - 1) || null;
    } else { // targetPage is 1, not a new search (e.g., refresh or initial load)
      startAfterCursor = null;
    }
    
    try {
      const result: FetchUsersForAdminResult = await fetchUsersForAdmin(
        USERS_PER_PAGE,
        startAfterCursor,
        effectiveSearchTerm
      );

      if (result.success && result.users) {
        setUsersOnCurrentPage(result.users.filter(u => u.id !== undefined));
        setCurrentPageNumber(targetPage);
        setCurrentCursorField(result.cursorField || 'createdAt');
        setHasNextPage(result.hasMore || false);

        if (result.hasMore && result.lastVisibleValue) {
          setPageStartAfterCursors(prevMap => {
            const newMap = new Map(prevMap);
            newMap.set(targetPage, result.lastVisibleValue);
            return newMap;
          });
        } else if (!result.hasMore) {
            // Ensure no stale cursors for pages beyond the current if hasMore is false
             setPageStartAfterCursors(prevMap => {
                const newMap = new Map();
                for(let i=0; i<=targetPage; i++){
                    if(prevMap.has(i)) newMap.set(i, prevMap.get(i));
                }
                newMap.set(targetPage, null); // No cursor for next page
                return newMap;
            });
        }
      } else {
        setUsersOnCurrentPage([]);
        setHasNextPage(false);
        toast({
          title: "Error Loading Users",
          description: result.error || "Could not load users.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch users for page:", error);
      setUsersOnCurrentPage([]);
      setHasNextPage(false);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching users.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingPageData(false);
    }
  }, [adminUser?.id, toast, searchTerm]); 

  useEffect(() => {
    if (adminUser?.id) {
      loadUsersForPage(1); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUser?.id]); 

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    setSearchTerm(newSearchTerm);

    if (searchDebounceTimeoutRef.current) {
      clearTimeout(searchDebounceTimeoutRef.current);
    }
    searchDebounceTimeoutRef.current = setTimeout(() => {
      loadUsersForPage(1, newSearchTerm.trim() === '' ? null : newSearchTerm.trim());
    }, 500); // Debounce time: 500ms
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage !== currentPageNumber) {
        if (newPage > currentPageNumber && !hasNextPage && !(searchTerm && pageStartAfterCursors.get(currentPageNumber))) return; // Allow next if searching and cursor exists
        if (newPage < currentPageNumber && !pageStartAfterCursors.has(newPage -1) && newPage !== 1) return;
        
        if(newPage === 1) { // Resetting to page 1 (e.g. from Previous button)
            loadUsersForPage(1, searchTerm.trim() === '' ? null : searchTerm.trim());
        } else {
            loadUsersForPage(newPage);
        }
    }
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
      isActive: userToEdit.isActive === undefined ? true : userToEdit.isActive,
    });
    setEditFormErrors({});
    setShowEditUserDialog(true);
  };

  const handleEditFormChange = (field: keyof UserUpdateInput, value: string | number | boolean | UserRole | PayMode) => {
    setEditFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleEditRoleChange = (newRole: UserRole) => {
    setEditFormState(prev => {
        const newState: Partial<UserUpdateInput> = { ...prev, role: newRole };
        if (newRole !== 'employee') {
            newState.payMode = 'not_set';
            newState.rate = 0;
        } else {
            newState.payMode = prev.payMode && availablePayModes.includes(prev.payMode) ? prev.payMode : 'not_set';
            newState.rate = typeof prev.rate === 'number' ? prev.rate : 0;
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
        if (isNaN(rateToSubmit) || rateToSubmit < 0) {
            setEditFormErrors(prev => ({...prev, rate: "Rate must be a non-negative number."}));
            setIsSubmittingEdit(false);
            return;
        }
    } else if (editFormState.role !== 'employee') {
        rateToSubmit = 0; 
    }

    const updateData: UserUpdateInput = {
        displayName: editFormState.displayName || editingUser.displayName,
        role: editFormState.role || editingUser.role,
        payMode: editFormState.role === 'employee' ? (editFormState.payMode || 'not_set') : 'not_set',
        rate: rateToSubmit,
        isActive: editFormState.isActive === undefined ? true : editFormState.isActive,
    };

    const result = await updateUserByAdmin(adminUser.id, editingUser.id, updateData);

    if (result.success) {
      toast({ title: "User Updated", description: result.message });
      setShowEditUserDialog(false);
      setEditingUser(null);
      loadUsersForPage(currentPageNumber, searchTerm.trim() === '' ? null : searchTerm.trim()); 
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
      // Determine if we need to go to previous page after delete
      const newPageNumber = usersOnCurrentPage.length === 1 && currentPageNumber > 1 ? currentPageNumber - 1 : currentPageNumber;
      loadUsersForPage(newPageNumber, searchTerm.trim() === '' ? null : searchTerm.trim());
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
            <Button variant="outline" onClick={() => loadUsersForPage(currentPageNumber, searchTerm.trim() === '' ? null : searchTerm.trim())} disabled={isFetchingPageData} className="mr-2">
              <RefreshCw className={`h-4 w-4 ${isFetchingPageData ? 'animate-spin' : ''} mr-2`} />
              Refresh Current View
            </Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New User (Disabled)
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex-grow">
              <CardTitle className="font-headline">User List</CardTitle>
              <CardDescription>
                {isFetchingPageData && usersOnCurrentPage.length === 0 ? "Loading users..." : `Displaying ${usersOnCurrentPage.length} user(s) on page ${currentPageNumber}.`}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isFetchingPageData && usersOnCurrentPage.length === 0 && !searchTerm ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading users...</p>
            </div>
          ) : usersOnCurrentPage.length === 0 && !isFetchingPageData ? (
             <p className="text-muted-foreground text-center py-10">
                {searchTerm ? `No users found matching "${searchTerm}".` : "No users found."}
             </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pay Mode</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersOnCurrentPage.map((user) => (
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
                        <Badge variant={user.isActive === false ? "destructive" : "outline"} className={user.isActive !== false ? "border-green-500 text-green-600" : ""}>
                          {user.isActive === false ? <UserX className="mr-1 h-3 w-3"/> : <UserCheck className="mr-1 h-3 w-3"/>}
                          {user.isActive === false ? 'Inactive' : 'Active'}
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
              <div className="flex items-center justify-center mt-6 space-x-2 py-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPageNumber - 1); }}
                        className={currentPageNumber <= 1 ? "pointer-events-none opacity-50" : ""}
                        aria-disabled={currentPageNumber <=1}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#" isActive>
                        {currentPageNumber}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPageNumber + 1); }}
                        className={!hasNextPage ? "pointer-events-none opacity-50" : ""}
                        aria-disabled={!hasNextPage}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
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
                <Label htmlFor="editDisplayName">Display Name <span className="text-destructive">*</span></Label>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editRole">Role <span className="text-destructive">*</span></Label>
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
                <div className="pt-1.5">
                  <Label htmlFor="editIsActive">Account Status</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                      id="editIsActive"
                      checked={editFormState.isActive === undefined ? true : editFormState.isActive}
                      onCheckedChange={(checked) => handleEditFormChange('isActive', checked)}
                      disabled={adminUser?.id === editingUser.id}
                    />
                    <span>{editFormState.isActive === undefined ? 'Active' : (editFormState.isActive ? 'Active' : 'Inactive')}</span>
                  </div>
                   {adminUser?.id === editingUser.id && <p className="text-xs text-muted-foreground mt-1">Admin cannot deactivate own account.</p>}
                   {editFormErrors.isActive && <p className="text-sm text-destructive mt-1">{editFormErrors.isActive}</p>}
                </div>
              </div>

              {editFormState.role === 'employee' && (
                <>
                  <div>
                    <Label htmlFor="editPayMode">Pay Mode <span className="text-destructive">*</span></Label>
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
                    <Label htmlFor="editRate">Rate <span className="text-destructive">*</span></Label>
                    <Input
                      id="editRate"
                      type="number"
                      value={String(editFormState.rate ?? 0)} 
                      onChange={(e) => handleEditFormChange('rate', e.target.valueAsNumber)}
                      className="mt-1"
                      min="0"
                      step="0.01"
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
