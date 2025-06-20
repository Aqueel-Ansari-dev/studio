
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/context/auth-context";
import { Building, LogOut, Menu, UserCircle } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import Link from "next/link";
import type { ReactNode } from "react";

interface AppHeaderProps {
  onMenuClick?: () => void;
  sidebar?: ReactNode;
}

export function AppHeader({ onMenuClick, sidebar }: AppHeaderProps) {
  const { user, logout } = useAuth();

  const getInitials = (email?: string) => {
    if (!email) return "??";
    const parts = email.split('@')[0].split('.');
    if (parts.length > 1) {
      return parts.map(part => part[0]).join('').toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };
  
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2 md:hidden">
        {sidebar && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="left" 
              className="flex flex-col p-0"
              aria-label="Navigation Menu" // Added aria-label
            >
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="text-lg font-semibold">Navigation Menu</SheetTitle>
              </SheetHeader>
              {sidebar}
            </SheetContent>
          </Sheet>
        )}
      </div>
      
      <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold md:text-base">
        <Building className="h-6 w-6 text-primary" />
        <span className="font-headline text-xl">FieldOps MVP</span>
      </Link>
      
      <div className="ml-auto flex items-center gap-4">
        {user && <NotificationBell />}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${getInitials(user.email)}`} alt={user.email} data-ai-hint="user avatar" />
                  <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" /> {user.email} ({user.role})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
