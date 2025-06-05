
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, MoreHorizontal, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fetchUsersForAdmin, type UserForAdminList } from '@/app/actions/admin/fetchUsersForAdmin';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import type { UserRole, PayMode } from '@/types/database';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserForAdminList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await fetchUsersForAdmin();
      setUsers(fetchedUsers);
      console.log("Fetched users for admin page:", fetchedUsers); // Added log to verify data
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        title: "Error",
        description: "Could not load users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'supervisor': return 'secondary';
      case 'employee':
      default:
        return 'outline';
    }
  };

  const formatPayMode = (payMode?: PayMode): string => {
    if (!payMode || payMode === 'not_set') return 'Not Set';
    return payMode.charAt(0).toUpperCase() + payMode.slice(1);
  };

  const formatRate = (rate?: number, payMode?: PayMode): string => {
    if (payMode === 'not_set' || typeof rate !== 'number' || rate === 0) return 'N/A';
    // Basic formatting, consider currency e.g. user.rate.toFixed(2) if always decimal
    return String(rate); 
  };


  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Management" 
        description="View, add, and manage user accounts and their roles within the system."
        actions={
          <>
            <Button variant="outline" onClick={loadUsers} disabled={isLoading} className="mr-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} mr-2`} />
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
            {isLoading ? "Loading users..." : `Displaying ${users.length} user(s) in the system.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No users found in the system.</p>
          ) : (
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
                {users.map((user) => (
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
                    <TableCell>{formatPayMode(user.payMode)}</TableCell>
                    <TableCell>{formatRate(user.rate, user.payMode)}</TableCell>
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
                          <DropdownMenuItem disabled>Edit User</DropdownMenuItem>
                          <DropdownMenuItem disabled className="text-destructive focus:text-destructive">Delete User</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
