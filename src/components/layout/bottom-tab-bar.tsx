
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { navConfig, type NavItem } from "./app-sidebar-nav";
import { cn } from "@/lib/utils";

export function BottomTabBar() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  let roleSpecificDashboardHref = "/dashboard";
  switch (user.role) {
    case 'employee': roleSpecificDashboardHref = "/dashboard/employee/projects"; break;
    case 'supervisor': roleSpecificDashboardHref = "/dashboard/supervisor/overview"; break;
    case 'admin': roleSpecificDashboardHref = "/dashboard/admin/overview"; break;
  }

  const mobileNavItems = navConfig
    .filter(item => item.roles.includes(user.role) && item.mobile)
    .map(item => item.href === "/dashboard" ? { ...item, href: roleSpecificDashboardHref } : item);

  const seenHrefs = new Set<string>();
  const uniqueMobileNavItems = mobileNavItems.filter(item => {
    if (seenHrefs.has(item.href)) {
      return false;
    }
    seenHrefs.add(item.href);
    return true;
  });

  // Ensure an even number of items for symmetrical layout around the central button
  const navItems = uniqueMobileNavItems.slice(0, 4); 
  const leftItems = navItems.slice(0, 2);
  const rightItems = navItems.slice(2, 4);
    
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-background border-t border-border shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
      <div className="grid h-full grid-cols-5 items-center max-w-lg mx-auto">
        {leftItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== roleSpecificDashboardHref && item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex flex-col items-center justify-center px-2 text-muted-foreground hover:bg-muted/50 h-full",
                isActive && "text-primary font-semibold"
              )}
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-[10px] text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* This is the empty placeholder for the central floating action button */}
        <div />

        {rightItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== roleSpecificDashboardHref && item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex flex-col items-center justify-center px-2 text-muted-foreground hover:bg-muted/50 h-full",
                isActive && "text-primary font-semibold"
              )}
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-[10px] text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
