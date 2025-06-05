
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, ListChecks, Users, UserCog, LayoutDashboard, CheckCircle, AlertTriangle, Settings, BarChart3, FilePlus, ClipboardList, LibraryBig, PackagePlus, DollarSign, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  group?: string; // Optional grouping for visual separation or future features
}

const baseNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "supervisor", "admin"] },
  
  // Employee
  { href: "/dashboard/employee/projects", label: "My Projects", icon: Briefcase, roles: ["employee"], group: "Employee" },
  { href: "/dashboard/employee/expenses/log-expense", label: "Log Expense", icon: DollarSign, roles: ["employee"], group: "Employee" },
  // Placeholder for My Expenses page: { href: "/dashboard/employee/expenses/my-expenses", label: "My Expenses", icon: ReceiptText, roles: ["employee"], group: "Employee" },
  
  // Supervisor
  { href: "/dashboard/supervisor/overview", label: "Team Overview", icon: Users, roles: ["supervisor"], group: "Supervisor" },
  { href: "/dashboard/supervisor/assign-task", label: "Assign Task", icon: FilePlus, roles: ["supervisor"], group: "Supervisor" },
  { href: "/dashboard/supervisor/task-monitor", label: "Task Monitor", icon: ClipboardList, roles: ["supervisor"], group: "Supervisor" },
  { href: "/dashboard/supervisor/inventory/add-material", label: "Add Material", icon: PackagePlus, roles: ["supervisor", "admin"], group: "Supervisor" }, // Also for Admin
  { href: "/dashboard/supervisor/attendance-review", label: "Attendance Review", icon: CheckCircle, roles: ["supervisor"], group: "Supervisor" },
  { href: "/dashboard/supervisor/compliance-reports", label: "Compliance Reports", icon: AlertTriangle, roles: ["supervisor"], group: "Supervisor" },
  
  // Admin
  { href: "/dashboard/admin/overview", label: "Admin Overview", icon: LayoutDashboard, roles: ["admin"], group: "Admin"},
  { href: "/dashboard/admin/user-management", label: "User Management", icon: UserCog, roles: ["admin"], group: "Admin" },
  { href: "/dashboard/admin/project-management", label: "Project Management", icon: LibraryBig, roles: ["admin"], group: "Admin" },
  // { href: "/dashboard/admin/inventory/add-material", label: "Add Material", icon: PackagePlus, roles: ["admin"], group: "Admin" }, // Covered by supervisor link
  { href: "/dashboard/admin/system-settings", label: "System Settings", icon: Settings, roles: ["admin"], group: "Admin" },
  { href: "/dashboard/admin/reports", label: "Global Reports", icon: BarChart3, roles: ["admin"], group: "Admin" },
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

  // Filter items by role and then remove duplicates based on href, keeping the one for the current user's primary group if possible
  const uniqueNavItems = baseNavItems
    .filter(item => item.roles.includes(userRole))
    .map(item => item.href === "/dashboard" ? { ...item, href: roleSpecificDashboardHref } : item)
    .reduce((acc, current) => {
        const x = acc.find(item => item.href === current.href);
        if (!x) {
            return acc.concat([current]);
        } else {
            // Prefer item belonging to current user's role group if there's a duplicate href
            if (current.group?.toLowerCase() === userRole) {
                return acc.filter(item => item.href !== current.href).concat([current]);
            }
            return acc; 
        }
    }, [] as NavItem[])
    .filter(item => { // Ensure main dashboard link isn't duplicated if role-specific dashboard is same as general
        if (item.href === roleSpecificDashboardHref && item.label !== "Dashboard") {
          return false; 
        }
        return true;
    });


  return (
    <nav className={cn("flex flex-col gap-1 px-2 py-4 text-sm font-medium", className)}>
      {uniqueNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            pathname === item.href || (item.href !== roleSpecificDashboardHref && item.href !== "/dashboard" && pathname.startsWith(item.href)) 
              ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
              : "text-muted-foreground", // Use muted-foreground for non-active items for better distinction
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

    