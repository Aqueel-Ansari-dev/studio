
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { HeatmapDataPoint } from '@/app/actions/owner/getUsageHeatmapData';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AttendanceButton } from '../attendance/AttendanceButton';
import { ListChecks } from 'lucide-react';

interface UsageHeatmapProps {
  data: HeatmapDataPoint[] | null;
  isLoading: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 12 }, (_, i) => `${i + 1}${i + 1 === 12 ? 'pm' : (i < 8 ? 'am' : 'pm')}`); // Simple 12-hour labels

export function UsageHeatmap({ data, isLoading }: UsageHeatmapProps) {
  const [dataType, setDataType] = useState<'tasks' | 'attendance'>('tasks');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!data) {
     return (
         <Card>
            <CardHeader>
                <CardTitle>Platform Usage Heatmap</CardTitle>
                <CardDescription>Could not load heatmap data.</CardDescription>
            </CardHeader>
         </Card>
    )
  }

  const processedData = new Map<string, HeatmapDataPoint>();
  data.forEach(d => {
    processedData.set(`${d.day}-${d.hour}`, d);
  });
  
  // Find max value for color scaling
  const maxCount = Math.max(...data.map(d => d[dataType]));

  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-muted/30';
    const intensity = Math.min(count / maxCount, 1);
    if (intensity > 0.7) return 'bg-primary/80';
    if (intensity > 0.4) return 'bg-primary/60';
    if (intensity > 0.1) return 'bg-primary/40';
    return 'bg-primary/20';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Platform Usage Heatmap</CardTitle>
            <CardDescription>Weekly activity overview by day and hour.</CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={dataType}
            onValueChange={(value: 'tasks' | 'attendance') => value && setDataType(value)}
            aria-label="Data Type"
          >
            <ToggleGroupItem value="tasks" aria-label="Tasks"><ListChecks className="h-4 w-4"/></ToggleGroupItem>
            <ToggleGroupItem value="attendance" aria-label="Attendance"><AttendanceButton /></ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground">{day}</div>
            ))}
            {Array.from({ length: 24 * 7 }).map((_, i) => {
              const dayIndex = i % 7;
              const hourIndex = Math.floor(i / 7);
              const day = DAYS[dayIndex];
              const hour = `${hourIndex.toString().padStart(2, '0')}:00`;
              const point = processedData.get(`${day}-${hour}`);
              const count = point ? point[dataType] : 0;
              
              return (
                <Tooltip key={`${day}-${hour}`} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className={cn("h-3 w-full rounded-sm", getColorClass(count))} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm font-medium">
                      {day}, {hour}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {count} {dataType === 'tasks' ? 'tasks created' : 'check-ins'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
        <div className="flex justify-end items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>Less Active</span>
            <div className="flex gap-px">
                <div className="h-3 w-3 rounded-sm bg-primary/20"/>
                <div className="h-3 w-3 rounded-sm bg-primary/40"/>
                <div className="h-3 w-3 rounded-sm bg-primary/60"/>
                <div className="h-3 w-3 rounded-sm bg-primary/80"/>
            </div>
            <span>More Active</span>
        </div>
      </CardContent>
    </Card>
  );
}
