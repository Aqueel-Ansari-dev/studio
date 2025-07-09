
"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface UserRolePieChartProps {
    roleCounts: {
        admin: number;
        supervisor: number;
        employee: number;
    },
    totalUsers: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

export function UserRolePieChart({ roleCounts, totalUsers }: UserRolePieChartProps) {
  const chartData = [
    { role: 'Admin', users: roleCounts.admin, fill: 'var(--color-admins)' },
    { role: 'Supervisor', users: roleCounts.supervisor, fill: 'var(--color-supervisors)' },
    { role: 'Employee', users: roleCounts.employee, fill: 'var(--color-employees)' },
  ];

  const chartConfig = {
    users: {
      label: "Users",
    },
    admins: {
      label: "Admins",
      color: "hsl(var(--chart-1))",
    },
    supervisors: {
      label: "Supervisors",
      color: "hsl(var(--chart-2))",
    },
    employees: {
      label: "Employees",
      color: "hsl(var(--chart-3))",
    },
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle>Users by Role</CardTitle>
        <CardDescription>Distribution of all user roles across the platform.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-full"
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                />
              <Pie
                data={chartData}
                dataKey="users"
                nameKey="role"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={60}
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                  return (
                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                 {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      <CardContent className="pb-4">
        <div className="flex justify-center space-x-4 text-sm">
            {chartData.map((entry, index) => (
                <div key={entry.role} className="flex items-center">
                    <span className="w-2.5 h-2.5 rounded-full mr-2" style={{backgroundColor: COLORS[index]}}></span>
                    {entry.role} ({entry.users})
                </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
