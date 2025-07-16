
"use client";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase } from "lucide-react";
import Link from "next/link";
import { AddToHomeScreenPrompt } from "@/components/pwa/AddToHomeScreenPrompt";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import AttendanceButton from "@/components/attendance/AttendanceButton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isClientMounted, setIsClientMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      if (user.branding?.customHeaderTitle) {
        document.title = user.branding.customHeaderTitle;
      } else if (user.branding?.companyName) {
        document.title = user.branding.companyName;
      } else {
        document.title = "FieldOps Dashboard";
      }
    }
  }, [user]);

  useEffect(() => {
    if (isClientMounted && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, isClientMounted]);

  if (!isClientMounted || loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
       <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden border-r bg-sidebar text-sidebar-foreground md:block md:w-64 lg:w-72">
          <div className="flex h-full max-h-screen flex-col">
              <ScrollArea className="flex-1">
                <AppSidebarNav userRole={user?.role} />
              </ScrollArea>
          </div>
        </aside>
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      {isMobile && <BottomTabBar />}
      <AttendanceButton />
      <AddToHomeScreenPrompt />
    </div>
  );
}
