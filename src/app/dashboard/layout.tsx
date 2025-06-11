
"use client";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isClientMounted, setIsClientMounted] = useState(false);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    if (isClientMounted && !loading && !user) {
      router.push('/');
    }
  }, [user, loading, router, isClientMounted]);

  if (!isClientMounted || loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  const SidebarContent = (
    <>
      <div className="flex h-16 items-center border-b px-4 shrink-0 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold">
            <Building className="h-6 w-6 text-primary" />
            <span className="font-headline text-xl">FieldOps</span>
        </Link>
      </div>
      <ScrollArea className="flex-1">
        <AppSidebarNav userRole={user?.role} isMobile={true} className="md:hidden" />
        <AppSidebarNav userRole={user?.role} className="hidden md:block" />
      </ScrollArea>
    </>
  );


  return (
    <div className="flex min-h-screen w-full flex-col">
       <AppHeader sidebar={SidebarContent} />
      <div className="flex flex-1">
        <aside className="hidden border-r bg-sidebar text-sidebar-foreground md:block md:w-64 lg:w-72">
          <div className="flex h-full max-h-screen flex-col">
            {SidebarContent}
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-background overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
