
'use server';

// In a real app, you would query your analytics database (e.g., BigQuery, or aggregated Firestore logs)
// to get this data. For this prototype, we will generate mock data.

export interface HeatmapDataPoint {
  day: string;
  hour: string;
  tasks: number;
  attendance: number;
}

export interface GetUsageHeatmapDataResult {
  success: boolean;
  data?: HeatmapDataPoint[];
  error?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export async function getUsageHeatmapData(): Promise<GetUsageHeatmapDataResult> {
  try {
    const data: HeatmapDataPoint[] = [];

    // Simulate peak usage during weekdays and business hours
    for (const day of DAYS) {
      for (const hour of HOURS) {
        const hourNum = parseInt(hour.split(':')[0]);
        const isWeekday = !['Sat', 'Sun'].includes(day);
        const isBusinessHour = hourNum >= 8 && hourNum <= 18;

        let baseTaskCount = 0;
        let baseAttendanceCount = 0;

        if (isWeekday && isBusinessHour) {
          // Peak activity
          if (hourNum >= 9 && hourNum <= 11) {
            baseTaskCount = 80 + Math.random() * 40; // 80-120
            baseAttendanceCount = 60 + Math.random() * 30; // 60-90
          } else if (hourNum >= 14 && hourNum <= 16) {
            baseTaskCount = 70 + Math.random() * 50; // 70-120
            baseAttendanceCount = 50 + Math.random() * 20; // 50-70
          } else {
            // Shoulder hours
            baseTaskCount = 20 + Math.random() * 30; // 20-50
            baseAttendanceCount = 10 + Math.random() * 20; // 10-30
          }
        } else {
          // Off-peak
          baseTaskCount = Math.random() * 10; // 0-10
          baseAttendanceCount = Math.random() * 5; // 0-5
        }
        
        data.push({
          day,
          hour,
          tasks: Math.round(baseTaskCount),
          attendance: Math.round(baseAttendanceCount),
        });
      }
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}
