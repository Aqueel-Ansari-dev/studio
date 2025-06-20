
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, ListChecks, Users, UserCog, LayoutDashboard, CheckCircle, AlertTriangle, Settings, BarChart3, FilePlus, ClipboardList, LibraryBig, PackagePlus, DollarSign, ReceiptText, Archive, CreditCard, Files, TestTube2, WalletCards, Receipt, GraduationCap, MapPin, CalendarDays, Map, UserCircle2, UserCheck } from "lucide-react"; // Added UserCheck
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  group?: string; // Optional grouping for visual separation or future features
}

// ORDER MATTERS FOR VISUAL GROUPING IN THE SIDEBAR.
// The 'group' property is mostly for internal logic of uniqueNavItems, not visual rendering by default.
// Items are ordered here to create logical sections for each role.

const baseNavItems: NavItem[] = [
  // --- GENERAL (Applies to All Logged-in Users) ---
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "supervisor", "admin"], group: "General" },
  { href: "/dashboard/profile", label: "My Profile", icon: UserCircle2, roles: ["employee", "supervisor", "admin"], group: "General" },

  // --- EMPLOYEE MENU ---
  { href: "/dashboard/employee/projects", label: "My Projects & Tasks", icon: Briefcase, roles: ["employee"], group: "Employee Menu" },
  { href: "/dashboard/employee/attendance", label: "My Attendance Log", icon: MapPin, roles: ["employee"], group: "Employee Menu" },
  { href: "/dashboard/employee/expenses/log-expense", label: "Log New Expense", icon: DollarSign, roles: ["employee"], group: "Employee Menu" },
  { href: "/dashboard/employee/expenses/my-expenses", label: "My Submitted Expenses", icon: ReceiptText, roles: ["employee"], group: "Employee Menu" },
  { href: "/dashboard/employee/leave-request", label: "My Leave Requests", icon: CalendarDays, roles: ["employee"], group: "Employee Menu" },
  { href: "/dashboard/employee/training", label: "Training Materials", icon: GraduationCap, roles: ["employee"], group: "Employee Menu" },

  // --- SUPERVISOR MENU ---
  // Team & Task Management (Supervisor)
  { href: "/dashboard/supervisor/overview", label: "Team Dashboard", icon: Users, roles: ["supervisor", "admin"], group: "Supervisor: Team & Tasks" }, // Admin can also access
  { href: "/dashboard/supervisor/assign-task", label: "Assign Tasks", icon: FilePlus, roles: ["supervisor", "admin"], group: "Supervisor: Team & Tasks" }, // Admin can also access
  { href: "/dashboard/supervisor/task-monitor", label: "Monitor All Tasks", icon: ClipboardList, roles: ["supervisor", "admin"], group: "Supervisor: Team & Tasks" }, // Admin can also access
  // Reviews & Compliance (Supervisor)
  { href: "/dashboard/supervisor/compliance-reports", label: "Task Compliance Review", icon: AlertTriangle, roles: ["supervisor", "admin"], group: "Supervisor: Reviews" }, // Admin can also access
  { href: "/dashboard/supervisor/attendance-review", label: "Review Team Attendance", icon: UserCheck, roles: ["supervisor", "admin"], group: "Supervisor: Reviews" }, // Admin can also access
  
  // ADMIN ONLY - These were previously shared but are now admin-focused or removed from supervisor view
  { href: "/dashboard/supervisor/expense-review", label: "Review Team Expenses", icon: CreditCard, roles: ["admin"], group: "Admin: Operations Oversight" }, 
  { href: "/dashboard/supervisor/inventory", label: "View Project Inventories", icon: Archive, roles: ["admin"], group: "Admin: Operations Oversight" }, 
  { href: "/dashboard/supervisor/inventory/add-material", label: "Add Material to Inventory", icon: PackagePlus, roles: ["admin"], group: "Admin: Operations Oversight" },
  { href: "/dashboard/supervisor/expenses", label: "View All Team Expenses", icon: Files, roles: ["admin"], group: "Admin: Operations Oversight" }, 
  { href: "/dashboard/supervisor/attendance-map", label: "Team Attendance Map", icon: Map, roles: ["admin"], group: "Admin: Operations Oversight" },


  // --- ADMIN MENU ---
  // Core Administration (Admin)
  { href: "/dashboard/admin/overview", label: "Admin Dashboard", icon: LayoutDashboard, roles: ["admin"], group: "Admin: Core Admin"}, // Specific Admin Dashboard
  { href: "/dashboard/admin/project-management", label: "Manage All Projects", icon: LibraryBig, roles: ["admin"], group: "Admin: Core Admin" }, // Create/Edit/Delete Projects is here
  { href: "/dashboard/admin/user-management", label: "Manage Users & Roles", icon: UserCog, roles: ["admin"], group: "Admin: Core Admin" },
  { href: "/dashboard/admin/system-settings", label: "System Configuration", icon: Settings, roles: ["admin"], group: "Admin: Core Admin" },
  // Operational Oversight (Admin) - Admin specific versions or global views
  { href: "/dashboard/admin/attendance-review", label: "Global Attendance Oversight", icon: UserCheck, roles: ["admin"], group: "Admin: Operations Oversight" }, // Different page than supervisor's
  { href: "/dashboard/admin/leave-review", label: "Review All Leave Requests", icon: CalendarDays, roles: ["admin"], group: "Admin: Operations Oversight" },
  { href: "/dashboard/admin/reports", label: "System-Wide Reports", icon: BarChart3, roles: ["admin"], group: "Admin: Operations Oversight" },
  // Financial Operations (Admin)
  { href: "/dashboard/admin/sales-billing", label: "Client Sales & Billing", icon: Receipt, roles: ["admin"], group: "Admin: Financial" },
  { href: "/dashboard/admin/invoices", label: "Client Invoices", icon: ReceiptText, roles: ["admin"], group: "Admin: Financial" },
  { href: "/dashboard/admin/payroll", label: "Payroll Management", icon: WalletCards, roles: ["admin"], group: "Admin: Financial" },
  { href: "/dashboard/admin/payroll-test-panel", label: "Payroll Test Panel", icon: TestTube2, roles: ["admin"], group: "Admin: Financial" }, // Kept for testing purposes
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
  
  const navItemsForRole = baseNavItems
    .filter(item => item.roles.includes(userRole))
    .map(item => item.href === "/dashboard" ? { ...item, href: roleSpecificDashboardHref } : item);

  // This reduce logic tries to pick the most specific item if hrefs overlap,
  // e.g. if an Admin is also a Supervisor, it might prefer the "Admin" group item.
  // For now, our hrefs are mostly unique per role, or explicitly shared.
  const uniqueNavItems = navItemsForRole.reduce((acc, current) => {
    const existingIndex = acc.findIndex(item => item.href === current.href);
    if (existingIndex !== -1) {
      const currentGroupIsRoleSpecific = current.group?.toLowerCase().startsWith(userRole);
      const existingGroupIsRoleSpecific = acc[existingIndex].group?.toLowerCase().startsWith(userRole);

      if (currentGroupIsRoleSpecific && !existingGroupIsRoleSpecific) {
        acc[existingIndex] = current; 
      } else if (currentGroupIsRoleSpecific && existingGroupIsRoleSpecific) {
         // If both are role specific, prefer the one explicitly for this role if possible
         // This case might need more refined logic if labels must differ for same href but diff roles.
         // For now, the first one matching (due to order in baseNavItems) or more specific group is taken.
         if (current.group?.toLowerCase().startsWith(userRole)) {
             acc[existingIndex] = current;
         }
      }
      // If neither new nor existing is specifically for this role's group, keep existing one.
    } else {
      acc.push(current);
    }
    return acc;
  }, [] as NavItem[]);


  return (
    <nav className={cn("flex flex-col gap-1 px-2 py-4 text-sm font-medium", className)}>
      {uniqueNavItems.map((item) => (
        <Link
          key={item.href + (item.group || '') + item.label} 
          href={item.href}
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

