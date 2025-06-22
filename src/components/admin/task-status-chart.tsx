
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { GlobalTaskCompletionSummary } from "@/app/actions/admin/fetchGlobalSummaries";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskStatusChartProps {
  data: GlobalTaskCompletionSummary | null;
}

export function TaskStatusChart({ data }: TaskStatusChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task Status Distribution</CardTitle>
          <CardDescription>Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
           <Skeleton className="w-full h-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { status: 'Pending', count: data.pendingTasks, fill: "var(--color-pending)" },
    { status: 'In Progress', count: data.inProgressTasks, fill: "var(--color-in-progress)" },
    { status: 'Needs Review', count: data.needsReviewTasks, fill: "var(--color-needs-review)" },
    { status: 'Completed', count: data.completedTasks, fill: "var(--color-completed)" },
    { status: 'Verified', count: data.verifiedTasks, fill: "var(--color-verified)" },
    { status: 'Rejected', count: data.rejectedTasks, fill: "var(--color-rejected)" },
  ];
  
  const chartConfig = {
    count: { label: "Tasks" },
    pending: { label: "Pending", color: "hsl(var(--chart-1))" },
    "in-progress": { label: "In Progress", color: "hsl(var(--chart-2))" },
    "needs-review": { label: "Needs Review", color: "hsl(var(--chart-3))" },
    completed: { label: "Completed", color: "hsl(var(--chart-4))" },
    verified: { label: "Verified", color: "hsl(var(--chart-5))" },
    rejected: { label: "Rejected", color: "hsl(var(--destructive))" },
  } satisfies ChartConfig;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Task Status Distribution</CardTitle>
        <CardDescription>Live overview of all {data.totalTasks} tasks in the system.</CardDescription>
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
                width={80}
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
