"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { GlobalTaskCompletionSummary } from "@/app/actions/admin/fetchGlobalSummaries";

interface TaskStatusChartProps {
  data: GlobalTaskCompletionSummary | null;
}

export function TaskStatusChart({ data }: TaskStatusChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task Status Distribution</CardTitle>
          <CardDescription>No data available to display chart.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>Could not load task summary data.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { status: 'Pending', count: data.pendingTasks },
    { status: 'In Progress', count: data.inProgressTasks },
    { status: 'Needs Review', count: data.needsReviewTasks },
    { status: 'Completed', count: data.completedTasks },
    { status: 'Verified', count: data.verifiedTasks },
    { status: 'Rejected', count: data.rejectedTasks },
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Task Status Distribution</CardTitle>
        <CardDescription>A live overview of all {data.totalTasks} tasks in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" dataKey="count" hide />
              <YAxis 
                type="category" 
                dataKey="status" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={10}
                width={80}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="count" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
