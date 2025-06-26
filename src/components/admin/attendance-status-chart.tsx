
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { GlobalAttendanceSummary } from "@/app/actions/admin/fetchGlobalSummaries";
import { Skeleton } from "@/components/ui/skeleton";

interface AttendanceSummaryChartProps {
  data: GlobalAttendanceSummary | null;
}

export function AttendanceSummaryChart({ data }: AttendanceSummaryChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance Summary</CardTitle>
          <CardDescription>Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
           <Skeleton className="w-full h-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { status: 'Checked In', count: data.checkedIn, fill: "var(--color-checkedIn)" },
    { status: 'Pending Review', count: data.pendingReview, fill: "var(--color-pendingReview)" },
    { status: 'Approved', count: data.approved, fill: "var(--color-approved)" },
    { status: 'Rejected', count: data.rejected, fill: "var(--color-rejected)" },
  ];
  
  const chartConfig = {
    count: { label: "Logs" },
    checkedIn: { label: "Checked In", color: "hsl(var(--color-checkedIn))" },
    pendingReview: { label: "Pending Review", color: "hsl(var(--color-pendingReview))" },
    approved: { label: "Approved", color: "hsl(var(--color-approved))" },
    rejected: { label: "Rejected", color: "hsl(var(--color-rejected))" },
  } satisfies ChartConfig;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Attendance Summary</CardTitle>
        <CardDescription>Live overview of all {data.totalLogs} logs.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" dataKey="count" hide />
              <YAxis 
                type="category" 
                dataKey="status" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10}
                width={100}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="count" radius={5} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
