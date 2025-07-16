
"use client";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddToHomeScreenPrompt } from "@/components/pwa/AddToHomeScreenPrompt";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import AttendanceButton from "@/components/attendance/AttendanceButton";
import Chatbot from "@/components/chatbot/Chatbot";

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
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 200 200"
              className="w-20 h-20 text-primary"
            >
              <circle
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="15"
                r="15"
                cx="40"
                cy="65"
              >
                <animate
                  attributeName="cy"
                  calcMode="spline"
                  dur="2"
                  values="65;135;65;"
                  keySplines=".5 0 .5 1;.5 0 .5 1"
                  repeatCount="indefinite"
                  begin="-.4"
                ></animate>
              </circle>
              <circle
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="15"
                r="15"
                cx="100"
                cy="65"
              >
                <animate
                  attributeName="cy"
                  calcMode="spline"
                  dur="2"
                  values="65;135;65;"
                  keySplines=".5 0 .5 1;.5 0 .5 1"
                  repeatCount="indefinite"
                  begin="-.2"
                ></animate>
              </circle>
              <circle
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="15"
                r="15"
                cx="160"
                cy="65"
              >
                <animate
                  attributeName="cy"
                  calcMode="spline"
                  dur="2"
                  values="65;135;65;"
                  keySplines=".5 0 .5 1;.5 0 .5 1"
                  repeatCount="indefinite"
                  begin="0"
                ></animate>
              </circle>
            </svg>
            <p className="font-semibold">Loading Dashboard...</p>
        </div>
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
      {user.role !== 'owner' && <AttendanceButton />}
      {user.role !== 'owner' && <Chatbot />}
      <AddToHomeScreenPrompt />
    </div>
  );
}
