import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LibraryBig, Users, ClipboardList, ShieldCheck, ArrowRight, Activity, Wallet, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { getAdminDashboardStats } from "@/app/actions/admin/getDashboardStats";
import { fetchGlobalTaskCompletionSummary } from "@/app/actions/admin/fetchGlobalSummaries";
import { TaskStatusChart } from "@/components/admin/task-status-chart";

// Helper component for stat cards for better organization
function StatCard({ title, value, icon: Icon, description, link }: { title: string, value: string | number, icon: React.ElementType, description: string, link: string }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
        <Link href={link} className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Link>
    </Card>
  );
}

// Main page component
export default async function AdminOverviewPage() {
  const [stats, taskSummary] = await Promise.all([
    getAdminDashboardStats(),
    fetchGlobalTaskCompletionSummary()
  ]);

  const totalPendingReviews = stats.tasksNeedingReview + stats.expensesNeedingReview;

  const quickLinks = [
      { href: "/dashboard/admin/user-management", label: "Manage Users & Roles", icon: Users },
      { href: "/dashboard/admin/project-management", label: "Manage All Projects", icon: LibraryBig },
      { href: "/dashboard/admin/reports", label: "View Global Reports", icon: Activity },
      { href: "/dashboard/admin/invoices", label: "Client Invoices", icon: Wallet },
      { href: "/dashboard/admin/leave-review", label: "Review Leave Requests", icon: FileText },
      { href: "/dashboard/admin/system-settings", label: "System Configuration", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Admin Dashboard" 
        description="Oversee system operations, manage users, and view key metrics."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Projects" value={stats.totalProjects} icon={LibraryBig} description="All projects in the system" link="/dashboard/admin/project-management" />
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} description="All roles" link="/dashboard/admin/user-management" />
        <StatCard title="Tasks In Progress" value={stats.tasksInProgress} icon={ClipboardList} description="Actively worked on" link="/dashboard/supervisor/task-monitor" />
        <StatCard title="Pending Reviews" value={totalPendingReviews} icon={ShieldCheck} description="Tasks, expenses, & leave" link="/dashboard/admin/reports" />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <TaskStatusChart data={taskSummary} />
        </div>
        <div className="lg:col-span-3">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="font-headline">Quick Actions</CardTitle>
                    <CardDescription>Navigate to key management areas.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                   {quickLinks.map(link => (
                        <Link href={link.href} key={link.href} passHref>
                            <Button variant="outline" className="w-full justify-start h-12">
                                <link.icon className="mr-3 h-5 w-5 text-muted-foreground" />
                                {link.label}
                                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                            </Button>
                        </Link>
                   ))}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
