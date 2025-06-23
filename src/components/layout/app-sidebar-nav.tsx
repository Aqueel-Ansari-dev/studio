
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Briefcase, ListChecks, Users, UserCog, LayoutDashboard, CheckCircle, 
  AlertTriangle, Settings, BarChart3, FilePlus, ClipboardList, LibraryBig, 
  PackagePlus, DollarSign, ReceiptText, Archive, CreditCard, Files, 
  TestTube2, WalletCards, Receipt, GraduationCap, MapPin, CalendarDays, 
  Map as MapIcon, Plane, UserCheck, ShieldCheck, PlusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const baseNavItems: NavItem[] = [
  // --- General ---
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "supervisor", "admin"] },

  // --- Employee Links ---
  { href: "/dashboard/employee/projects", label: "My Projects", icon: Briefcase, roles: ["employee"] },
  { href: "/dashboard/employee/attendance", label: "My Attendance", icon: CalendarDays, roles: ["employee"] },
  { href: "/dashboard/employee/leave-request", label: "Leave Requests", icon: Plane, roles: ["employee"] },
  { href: "/dashboard/employee/expenses/my-expenses", label: "My Expenses", icon: ReceiptText, roles: ["employee"] },
  { href: "/dashboard/employee/training", label: "Training", icon: GraduationCap, roles: ["employee", "supervisor"] },

  // --- Supervisor Links ---
  { href: "/dashboard/supervisor/overview", label: "Team Dashboard", icon: Users, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/assign-task", label: "Assign Tasks", icon: FilePlus, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/task-monitor", label: "Monitor Tasks", icon: ClipboardList, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/compliance-reports", label: "Task Review", icon: ShieldCheck, roles: ["supervisor"] },
  { href: "/dashboard/supervisor/attendance-review", label: "Attendance Review", icon: UserCheck, roles: ["supervisor"] },
  
  // --- Admin Links ---
  // Overrides supervisor links with admin-centric labels where needed
  { href: "/dashboard/admin/overview", label: "Admin Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/dashboard/supervisor/task-monitor", label: "Task Monitor (All)", icon: ClipboardList, roles: ["admin"] },
  { href: "/dashboard/supervisor/attendance-review", label: "Attendance Oversight", icon: UserCheck, roles: ["admin"] },
  { href: "/dashboard/supervisor/compliance-reports", label: "Compliance Oversight", icon: ShieldCheck, roles: ["admin"] },

  // Admin-only pages
  { href: "/dashboard/admin/project-management", label: "Projects", icon: LibraryBig, roles: ["admin"] },
  { href: "/dashboard/admin/user-management", label: "Users", icon: UserCog, roles: ["admin"] },
  { href: "/dashboard/admin/training/library", label: "Training Library", icon: GraduationCap, roles: ["admin"] },
  { href: "/dashboard/admin/training/add", label: "Add Training", icon: PlusCircle, roles: ["admin"] },
  { href: "/dashboard/supervisor/attendance-map", label: "Attendance Map", icon: MapIcon, roles: ["admin"] },
  { href: "/dashboard/admin/leave-review", label: "Leave Requests", icon: Plane, roles: ["admin"] },
  { href: "/dashboard/supervisor/expense-review", label: "Expense Review", icon: CreditCard, roles: ["admin"] },
  { href: "/dashboard/supervisor/inventory", label: "Inventories", icon: Archive, roles: ["admin"] },
  { href: "/dashboard/admin/payroll", label: "Payroll", icon: WalletCards, roles: ["admin"] },
  { href: "/dashboard/admin/invoices", label: "Invoices", icon: ReceiptText, roles: ["admin"] },
  { href: "/dashboard/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { href: "/dashboard/admin/system-settings", label: "Settings", icon: Settings, roles: ["admin"] },
];


interface AppSidebarNavProps {
  userRole: UserRole | undefined;
  className?: string;
  isMobile?: boolean;
  onLinkClick?: () => void;
}

export function AppSidebarNav({ userRole, className, isMobile = false, onLinkClick }: AppSidebarNavProps) {
  const pathname = usePathname();

  if (!userRole) {
    return null; 
  }

  let roleSpecificDashboardHref = "/dashboard";
  // Determine the primary dashboard page for the user's role
  switch (userRole) {
    case 'employee':
      roleSpecificDashboardHref = "/dashboard/employee/projects";
      break;
    case 'supervisor':
      roleSpecificDashboardHref = "/dashboard/supervisor/overview";
      break;
    case 'admin':
      roleSpecificDashboardHref = "/dashboard/admin/overview";
      break;
  }
  
  // Filter items for the current user's role
  const navItemsForRole = baseNavItems
    .filter(item => item.roles.includes(userRole))
    .map(item => item.href === "/dashboard" ? { ...item, href: roleSpecificDashboardHref } : item);

  // De-duplicate links, ensuring the last one in the list wins (e.g., admin label overrides supervisor label)
  const uniqueNavItemsMap = new Map<string, NavItem>();
  navItemsForRole.forEach(item => {
    uniqueNavItemsMap.set(item.href, item);
  });
  
  const uniqueNavItems = Array.from(uniqueNavItemsMap.values());


  return (
    <nav className={cn("flex flex-col gap-1 px-2 py-4 text-sm font-medium", className)}>
      {uniqueNavItems.map((item) => (
        <Link
          key={item.href} 
          href={item.href}
          onClick={onLinkClick}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            pathname === item.href || (item.href !== roleSpecificDashboardHref && item.href !== "/dashboard" && pathname.startsWith(item.href)) 
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
