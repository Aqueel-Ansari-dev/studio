
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/context/auth-context";
import { Building, LogOut, Menu, UserCircle, Settings } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

interface AppHeaderProps {
  sidebar?: ReactNode;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}

export function AppHeader({ sidebar, sheetOpen, onSheetOpenChange }: AppHeaderProps) {
  const { user, logout } = useAuth();

  const getInitials = (displayName?: string, email?: string) => {
    if (displayName) {
        const names = displayName.split(' ');
        if (names.length > 1) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return displayName.substring(0, 2).toUpperCase();
    }
    if (email) {
        return email.substring(0, 2).toUpperCase();
    }
    return "??";
  };
  
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2 md:hidden">
        {sidebar && (
          <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="left" 
              className="flex flex-col p-0"
              aria-label="Navigation Menu"
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
        <span className="font-headline text-xl">FieldOps</span>
      </Link>
      
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        {user && <NotificationBell />}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL || ''} alt={user.displayName || user.email} data-ai-hint="user avatar" />
                  <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" /> {user.displayName || user.email} ({user.role})
              </DropdownMenuItem>
               <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
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
