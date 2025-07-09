
"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
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
  type ChartConfig,
} from "@/components/ui/chart"

interface ActivityLineChartProps {
    initialData: {
        date: string;
        signIns: number;
        tasksCreated: number;
    }[];
}

const chartConfig = {
  signIns: {
    label: "Sign-ins",
    color: "hsl(var(--chart-1))",
  },
  tasksCreated: {
    label: "Tasks Created",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ActivityLineChart({ initialData }: ActivityLineChartProps) {
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: addDays(new Date(), -6),
        to: new Date(),
    })
    
    // In a real app, this would re-fetch data based on the selected date range.
    // For this prototype, we just use the initial data.

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-2 sm:flex-row md:items-center">
        <div className="grid flex-1 gap-1">
          <CardTitle>Platform Activity</CardTitle>
          <CardDescription>
            Daily sign-ins and tasks created across all organizations.
          </CardDescription>
        </div>
        <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[260px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            data={initialData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
             <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value}
                />
            <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <defs>
              <linearGradient id="fillSignIns" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-signIns)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-signIns)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillTasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-tasksCreated)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-tasksCreated)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area
              dataKey="signIns"
              type="natural"
              fill="url(#fillSignIns)"
              fillOpacity={0.4}
              stroke="var(--color-signIns)"
              stackId="a"
            />
            <Area
              dataKey="tasksCreated"
              type="natural"
              fill="url(#fillTasks)"
              fillOpacity={0.4}
              stroke="var(--color-tasksCreated)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
