
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Users, UserCog, Settings, BarChart3, 
  FilePlus, ClipboardList, LibraryBig, Package, DollarSign, 
  ReceiptText, CreditCard, WalletCards, GraduationCap, 
  Map, Plane, UserCheck, ShieldCheck, HardHat, GanttChart, Wrench, Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  group?: string;
}

const navConfig: NavItem[] = [
  // --- Employee ---
  { href: "/dashboard", label: "Dashboard", icon: Home, roles: ["employee"], group: 'General' },
  { href: "/dashboard/employee/projects", label: "My Tasks", icon: Wrench, roles: ["employee"], group: 'General' },
  { href: "/dashboard/employee/attendance", label: "My Attendance", icon: UserCheck, roles: ["employee"], group: 'General' },
  { href: "/dashboard/employee/expenses/my-expenses", label: "My Expenses", icon: ReceiptText, roles: ["employee"], group: 'Tools' },
  { href: "/dashboard/employee/leave-request", label: "Leave Requests", icon: Plane, roles: ["employee"], group: 'Tools' },
  { href: "/dashboard/employee/training", label: "Training", icon: GraduationCap, roles: ["employee", "supervisor"], group: 'Tools' },

  // --- Supervisor ---
  { href: "/dashboard/supervisor/overview", label: "Team Dashboard", icon: LayoutDashboard, roles: ["supervisor"], group: 'Management' },
  { href: "/dashboard/supervisor/assign-task", label: "Assign Tasks", icon: FilePlus, roles: ["supervisor"], group: 'Management' },
  { href: "/dashboard/supervisor/task-monitor", label: "Task Monitor", icon: ClipboardList, roles: ["supervisor"], group: 'Management' },
  { href: "/dashboard/supervisor/compliance-reports", label: "Task Review", icon: ShieldCheck, roles: ["supervisor"], group: 'Oversight' },
  { href: "/dashboard/supervisor/attendance-review", label: "Attendance Review", icon: UserCheck, roles: ["supervisor"], group: 'Oversight' },

  // --- Admin ---
  { href: "/dashboard/admin/overview", label: "Admin Dashboard", icon: LayoutDashboard, roles: ["admin"], group: 'Admin' },
  { href: "/dashboard/admin/project-management", label: "Projects", icon: GanttChart, roles: ["admin"], group: 'Admin' },
  { href: "/dashboard/admin/user-management", label: "Users", icon: UserCog, roles: ["admin"], group: 'Admin' },
  { href: "/dashboard/supervisor/task-monitor", label: "Task Monitor", icon: ClipboardList, roles: ["admin"], group: 'Admin' },
  
  { href: "/dashboard/admin/invoices", label: "Invoicing", icon: ReceiptText, roles: ["admin"], group: 'Financial' },
  { href: "/dashboard/admin/payroll", label: "Payroll", icon: WalletCards, roles: ["admin"], group: 'Financial' },
  { href: "/dashboard/supervisor/expense-review", label: "Expense Review", icon: CreditCard, roles: ["admin"], group: 'Financial' },
  { href: "/dashboard/supervisor/inventory", label: "Inventory", icon: Package, roles: ["admin"], group: 'Financial' },

  { href: "/dashboard/admin/reports", label: "Global Reports", icon: BarChart3, roles: ["admin"], group: 'System' },
  { href: "/dashboard/admin/system-settings", label: "System Settings", icon: Settings, roles: ["admin"], group: 'System' },
];


interface AppSidebarNavProps {
  userRole: UserRole | undefined;
  onLinkClick?: () => void;
}

export function AppSidebarNav({ userRole, onLinkClick }: AppSidebarNavProps) {
  const pathname = usePathname();

  if (!userRole) return null;

  let roleSpecificDashboardHref = "/dashboard";
  switch (userRole) {
    case 'employee': roleSpecificDashboardHref = "/dashboard/employee/projects"; break;
    case 'supervisor': roleSpecificDashboardHref = "/dashboard/supervisor/overview"; break;
    case 'admin': roleSpecificDashboardHref = "/dashboard/admin/overview"; break;
  }
  
  const navItemsForRole = navConfig
    .filter(item => item.roles.includes(userRole))
    .map(item => item.href === "/dashboard" ? { ...item, href: roleSpecificDashboardHref } : item);

  const uniqueNavItemsMap = new Map<string, NavItem>();
  navItemsForRole.forEach(item => {
    uniqueNavItemsMap.set(item.href, item);
  });
  
  const uniqueNavItems = Array.from(uniqueNavItemsMap.values());

  const groupedNavItems = uniqueNavItems.reduce((acc, item) => {
      const group = item.group || 'General';
      if(!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
  }, {} as Record<string, NavItem[]>);

  const groupOrder = userRole === 'admin' 
    ? ['Admin', 'Financial', 'System']
    : (userRole === 'supervisor' ? ['Management', 'Oversight', 'Tools'] : ['General', 'Tools']);


  return (
    <nav className="flex flex-col gap-1 px-2 py-4 text-sm font-medium">
      {groupOrder.map(groupName => (
          groupedNavItems[groupName] && (
            <div key={groupName} className="mb-4">
              <h3 className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">{groupName}</h3>
              <div className="space-y-1">
                {groupedNavItems[groupName].map((item) => (
                  <Link
                    key={item.href} 
                    href={item.href}
                    onClick={onLinkClick}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground/80 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      pathname === item.href || (item.href !== roleSpecificDashboardHref && item.href !== "/dashboard" && pathname.startsWith(item.href)) 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                        : "font-medium"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )
      ))}
    </nav>
  );
}
