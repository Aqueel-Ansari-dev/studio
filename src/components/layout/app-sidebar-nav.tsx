
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, ListChecks, Users, UserCog, LayoutDashboard, CheckCircle, AlertTriangle, Settings, BarChart3, FilePlus, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

// This list now serves as the source for all *potential* navigation items.
// The "Dashboard" link here is a placeholder whose href will be modified.
// Specific overview links like "My Projects", "Team Overview", "Admin Overview" will be filtered out
// if the main "Dashboard" link is modified to point to their respective pages.
const baseNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "supervisor", "admin"] },
  
  { href: "/dashboard/employee/projects", label: "My Projects", icon: Briefcase, roles: ["employee"] },
  
  { href: "/dashboard/supervisor/overview", label: "Team Overview", icon: Users, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/assign-task", label: "Assign Task", icon: FilePlus, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/task-monitor", label: "Task Monitor", icon: ClipboardList, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/attendance-review", label: "Attendance Review", icon: CheckCircle, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/compliance-reports", label: "Compliance Reports", icon: AlertTriangle, roles: ["supervisor"] },
  
  { href: "/dashboard/admin/overview", label: "Admin Overview", icon: LayoutDashboard, roles: ["admin"]},
  { href: "/dashboard/admin/user-management", label: "User Management", icon: UserCog, roles: ["admin"] },
  { href: "/dashboard/admin/system-settings", label: "System Settings", icon: Settings, roles: ["admin"] },
  { href: "/dashboard/admin/reports", label: "Global Reports", icon: BarChart3, roles: ["admin"] },
];

interface AppSidebarNavProps {
  userRole: UserRole | undefined;
  className?: string;
  isMobile?: boolean;
}

export function AppSidebarNav({ userRole, className, isMobile = false }: AppSidebarNavProps) {
  const pathname = usePathname();

  if (!userRole) {
    return null; 
  }

  let roleSpecificDashboardHref = "/dashboard";
  if (userRole === 'employee') {
    roleSpecificDashboardHref = "/dashboard/employee/projects";
  } else if (userRole === 'supervisor') {
    roleSpecificDashboardHref = "/dashboard/supervisor/overview";
  } else if (userRole === 'admin') {
    roleSpecificDashboardHref = "/dashboard/admin/overview";
  }

  const navItemsForDisplay = baseNavItems
    .map(item => {
      // Transform the generic "/dashboard" link to be role-specific
      if (item.href === "/dashboard") {
        return { ...item, href: roleSpecificDashboardHref };
      }
      return item;
    })
    .filter(item => item.roles.includes(userRole)) // Filter items based on user role
    .filter(item => {
      // Remove specific overview links if the main "Dashboard" link now points to their page,
      // unless the item *is* the main dashboard link itself.
      if (item.href === roleSpecificDashboardHref && item.label !== "Dashboard") {
        return false; 
      }
      return true;
    });


  return (
    <nav className={cn("flex flex-col gap-1 px-2 py-4 text-sm font-medium", className)}>
      {navItemsForDisplay.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            // Active state: if current path is exactly item's href,
            // OR if item.href is not the generic /dashboard and current path starts with item.href (for parent routes)
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)) 
              ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
              : "text-muted-foreground",
            isMobile ? "text-base" : "text-sm"
          )}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
