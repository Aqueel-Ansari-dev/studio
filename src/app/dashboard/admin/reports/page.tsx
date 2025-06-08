
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Global Reports" 
        description="View and generate system-wide operational reports."
         actions={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export All Data
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Overall Task Completion Report</CardTitle>
          <CardDescription>(Placeholder)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Charts and data tables showing task completion rates, average times, etc., across all projects and employees.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Attendance & Compliance Summary</CardTitle>
          <CardDescription>(Placeholder)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Summary reports on attendance records, anomaly rates, and overall compliance scores.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Stale Tasks Report</CardTitle>
          <CardDescription>Identify tasks assigned but never started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            Review tasks that remain in the pending state for more than two days.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/reports/stale-tasks">View Report</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
