
"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import { LogOut, UserCircle, Settings, PanelLeft, Briefcase } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebarNav } from "./app-sidebar-nav";
import { ScrollArea } from "../ui/scroll-area";


export function AppHeader() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="md:hidden">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground">
              <SheetHeader className="sr-only">
                  <SheetTitle>Main Menu</SheetTitle>
              </SheetHeader>
              <div className="flex h-14 items-center border-b border-sidebar-border px-4 shrink-0">
                <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-sidebar-foreground">
                    <Briefcase className="h-6 w-6 text-sidebar-primary" />
                    <span className="font-headline text-xl">FieldOps</span>
                </Link>
              </div>
              <ScrollArea className="flex-1">
                <AppSidebarNav userRole={user?.role} onLinkClick={() => setIsMobileMenuOpen(false)} />
              </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
      <div className="w-full flex-1">
        {/* Placeholder for potential breadcrumbs or page title */}
      </div>
      
      <div className="flex items-center gap-4">
        <ThemeToggle />
        {user && <NotificationBell />}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL || ''} alt={user.displayName || user.email} data-ai-hint="user avatar" />
                  <AvatarFallback className="bg-primary/20">{getInitials(user.displayName, user.email)}</AvatarFallback>
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
