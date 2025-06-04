
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCog, Settings, BarChart3, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Admin Dashboard" 
        description="Oversee system operations, manage users, and configure settings."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <UserCog className="h-8 w-8 mb-2 text-primary" />
            <CardTitle className="font-headline text-xl">User Management</CardTitle>
            <CardDescription>Manage employee, supervisor, and admin accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/admin/user-management">Go to User Management</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <Settings className="h-8 w-8 mb-2 text-primary" />
            <CardTitle className="font-headline text-xl">System Settings</CardTitle>
            <CardDescription>Configure application-wide settings and parameters.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/admin/system-settings">Go to System Settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <BarChart3 className="h-8 w-8 mb-2 text-primary" />
            <CardTitle className="font-headline text-xl">Global Reports</CardTitle>
            <CardDescription>View overall operational reports and analytics.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/admin/reports">View Reports</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-shadow duration-300 md:col-span-2 lg:col-span-3">
          <CardHeader>
            <ShieldAlert className="h-8 w-8 mb-2 text-destructive" />
            <CardTitle className="font-headline text-xl">System Health & Audits</CardTitle>
            <CardDescription>Monitor system status, security logs, and audit trails.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This section will provide tools for monitoring system health, security events, and comprehensive audit logs.
              (Functionality to be implemented)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
