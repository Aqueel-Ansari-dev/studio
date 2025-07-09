
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Users, UserCog, Settings, BarChart3, 
  FilePlus, ClipboardList, LibraryBig, Package, DollarSign, 
  ReceiptText, CreditCard, WalletCards, GraduationCap, 
  MapIcon, Plane, UserCheck, ShieldCheck, HardHat, GanttChart, Wrench, Home, UserCircle, History, Sparkles, Crown, Building
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole, PlanFeature } from "@/types/database";
import { useAuth } from "@/context/auth-context";
import { isFeatureAllowed } from "@/app/actions/owner/managePlans";
import { Badge } from "../ui/badge";
import { useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  group?: string;
  mobile?: boolean;
  feature?: PlanFeature;
}

export const navConfig: NavItem[] = [
  // --- Owner ---
  { href: "/dashboard/owner", label: "Analytics", icon: BarChart3, roles: ["owner"], group: 'Owner Panel' },
  { href: "/dashboard/owner/organizations", label: "Organizations", icon: Building, roles: ["owner"], group: 'Owner Panel' },
  { href: "/dashboard/owner/plan-manager", label: "Plan Manager", icon: Crown, roles: ["owner"], group: 'Owner Panel' },

  // --- Employee ---
  { href: "/dashboard/employee/projects", label: "My Tasks", icon: Wrench, roles: ["employee"], group: 'General', mobile: true },
  { href: "/dashboard/employee/attendance", label: "My Attendance", icon: UserCheck, roles: ["employee"], group: 'General', mobile: true },
  { href: "/dashboard/employee/expenses/my-expenses", label: "My Expenses", icon: ReceiptText, roles: ["employee"], group: 'Tools', mobile: true },
  { href: "/dashboard/employee/leave-request", label: "Leave Requests", icon: Plane, roles: ["employee"], group: 'Tools' },
  { href: "/dashboard/employee/training", label: "Training", icon: GraduationCap, roles: ["employee", "supervisor"], group: 'Tools' },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle, roles: ["employee", "supervisor", "admin"], mobile: true },

  // --- Supervisor ---
  { href: "/dashboard/supervisor/overview", label: "Dashboard", icon: LayoutDashboard, roles: ["supervisor"], group: 'Management', mobile: true },
  { href: "/dashboard/supervisor/assign-task", label: "Assign Tasks", icon: FilePlus, roles: ["supervisor"], group: 'Management', mobile: true },
  { href: "/dashboard/supervisor/task-monitor", label: "Task Monitor", icon: ClipboardList, roles: ["supervisor", "admin"], group: 'Management' },
  { href: "/dashboard/supervisor/compliance-reports", label: "Task Review", icon: ShieldCheck, roles: ["supervisor"], group: 'Oversight', mobile: true },
  { href: "/dashboard/supervisor/attendance-review", label: "Attendance", icon: UserCheck, roles: ["supervisor"], group: 'Oversight', mobile: true },
  { href: "/dashboard/supervisor/expenses/my-expenses", label: "My Expenses", icon: ReceiptText, roles: ["supervisor"], group: 'Tools', mobile: true },

  // --- Admin ---
  { href: "/dashboard/admin/overview", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"], group: 'Admin', mobile: true },
  { href: "/dashboard/admin/project-management", label: "Projects", icon: GanttChart, roles: ["admin"], group: 'Admin', mobile: true },
  { href: "/dashboard/admin/user-management", label: "Users", icon: UserCog, roles: ["admin"], group: 'Admin', mobile: true },
  
  { href: "/dashboard/admin/invoices", label: "Invoicing", icon: ReceiptText, roles: ["admin"], group: 'Financial', feature: 'Invoicing' },
  { href: "/dashboard/admin/payroll", label: "Payroll", icon: WalletCards, roles: ["admin"], group: 'Financial', feature: 'Payroll' },
  { href: "/dashboard/admin/billing", label: "Billing & Plan", icon: CreditCard, roles: ["admin"], group: 'Financial' },
  { href: "/dashboard/supervisor/expense-review", label: "Expense Review", icon: CreditCard, roles: ["admin"], group: 'Financial' },
  { href: "/dashboard/supervisor/inventory", label: "Inventory", icon: Package, roles: ["admin"], group: 'Financial' },

  { href: "/dashboard/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin"], group: 'System', mobile: true },
  { href: "/dashboard/supervisor/attendance-map", label: "Attendance Map", icon: MapIcon, roles: ["admin"], group: 'System' },
  { href: "/dashboard/admin/training/library", label: "Training Library", icon: GraduationCap, roles: ["admin"], group: 'System' },
  { href: "/dashboard/admin/system-settings", label: "System Settings", icon: Settings, roles: ["admin"], group: 'System' },
  { href: "/dashboard/admin/audit-trail", label: "Audit Trail", icon: History, roles: ["admin"], group: 'System' },
  { href: "/dashboard/admin/predefined-tasks", label: "Predefined Tasks", icon: LibraryBig, roles: ["admin"], group: 'System' },
];


interface AppSidebarNavProps {
  userRole: UserRole | undefined;
  onLinkClick?: () => void;
}

export function AppSidebarNav({ userRole, onLinkClick }: AppSidebarNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!userRole) return null;

  let roleSpecificDashboardHref = "/dashboard";
  switch (userRole) {
    case 'owner': roleSpecificDashboardHref = "/dashboard/owner"; break;
    case 'employee': roleSpecificDashboardHref = "/dashboard/employee/projects"; break;
    case 'supervisor': roleSpecificDashboardHref = "/dashboard/supervisor/overview"; break;
    case 'admin': roleSpecificDashboardHref = "/dashboard/admin/overview"; break;
  }
  
  const navItemsForRole = navConfig
    .filter(item => item.roles.includes(userRole))
    .map(item => item.href === "/dashboard" ? { ...item, href: roleSpecificDashboardHref } : item);

  const seenHrefs = new Set<string>();
  const uniqueNavItems = navItemsForRole.filter(item => {
    if (seenHrefs.has(item.href)) {
      return false;
    }
    seenHrefs.add(item.href);
    return true;
  });

  const groupedNavItems = uniqueNavItems.reduce((acc, item) => {
      const group = item.group || 'General';
      if(!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
  }, {} as Record<string, NavItem[]>);

  const groupOrder = userRole === 'owner' ? ['Owner Panel'] :
    userRole === 'admin' ? ['Admin', 'Management', 'Financial', 'System']
    : (userRole === 'supervisor' ? ['Management', 'Oversight', 'Tools'] : ['General', 'Tools']);


  return (
    <nav className="flex flex-col gap-1 px-2 py-4 text-sm font-medium">
      {groupOrder.map(groupName => (
          groupedNavItems[groupName] && (
            <div key={groupName} className="mb-4">
              <h3 className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">{groupName}</h3>
              <div className="space-y-1">
                {groupedNavItems[groupName].map((item) => (
                    <NavItemLink 
                        key={item.href}
                        item={item}
                        userPlanId={user?.planId}
                        pathname={pathname}
                        onLinkClick={onLinkClick}
                        roleSpecificDashboardHref={roleSpecificDashboardHref}
                    />
                ))}
              </div>
            </div>
          )
      ))}
    </nav>
  );
}


function NavItemLink({ item, userPlanId, pathname, onLinkClick, roleSpecificDashboardHref }: { item: NavItem, userPlanId?: string, pathname: string, onLinkClick?: () => void, roleSpecificDashboardHref: string }) {
  const [isAllowed, setIsAllowed] = useState(true);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  useEffect(() => {
    async function checkPermission() {
      if (item.feature) {
        setIsCheckingPermission(true);
        const allowed = await isFeatureAllowed(userPlanId, item.feature);
        setIsAllowed(allowed);
        setIsCheckingPermission(false);
      } else {
        setIsAllowed(true);
        setIsCheckingPermission(false);
      }
    }
    checkPermission();
  }, [item.feature, userPlanId]);
  
  const linkContent = (
     <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
           <item.icon className="h-5 w-5" />
           {item.label}
        </div>
        {!isAllowed && <Badge variant="secondary" className="text-xs bg-yellow-400/20 text-yellow-600 border-yellow-400/30">Upgrade</Badge>}
     </div>
  );
  
  if (isCheckingPermission) {
    return (
      <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground/50">
        <item.icon className="h-5 w-5" />
        {item.label}
      </div>
    );
  }

  if (!isAllowed) {
    return (
        <Link
          href="/dashboard/admin/billing"
          onClick={onLinkClick}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground/50 transition-all border-l-4 border-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer"
          )}
          title="Upgrade plan to access this feature"
        >
          {linkContent}
        </Link>
    );
  }
  
  return (
    <Link
      href={item.href}
      onClick={onLinkClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground/80 transition-all border-l-4 border-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        pathname === item.href || (item.href !== roleSpecificDashboardHref && item.href !== "/dashboard" && pathname.startsWith(item.href)) 
          ? "bg-sidebar-accent text-sidebar-primary-foreground font-semibold border-sidebar-primary"
          : "font-medium"
      )}
    >
      {linkContent}
    </Link>
  )
}
