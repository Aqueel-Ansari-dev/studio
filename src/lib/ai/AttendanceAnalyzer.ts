import type { AttendanceLog } from '@/types/database';

export interface AttendanceFlag {
  employeeId: string;
  lateDays: number;
  earlyLeaveDays: number;
}

/**
 * Analyze attendance logs to detect frequent late arrivals and early departures.
 */
export class AttendanceAnalyzer {
  static analyze(
    logs: AttendanceLog[],
    sensitivity: 'low' | 'medium' | 'high' = 'medium'
  ): { lateCount: number; earlyCount: number; flagged: AttendanceFlag[] } {
    const lateCount = logs.filter(l => l.arrivalStatus === 'late').length;
    const earlyCount = logs.filter(l => l.departureStatus === 'left-early').length;

    const grouped: Record<string, { late: number; early: number }> = {};
    for (const log of logs) {
      if (!grouped[log.employeeId]) grouped[log.employeeId] = { late: 0, early: 0 };
      if (log.arrivalStatus === 'late') grouped[log.employeeId].late += 1;
      if (log.departureStatus === 'left-early') grouped[log.employeeId].early += 1;
    }

    const threshold = sensitivity === 'high' ? 2 : sensitivity === 'low' ? 5 : 3;
    const flagged: AttendanceFlag[] = [];
    for (const [employeeId, counts] of Object.entries(grouped)) {
      if (counts.late >= threshold || counts.early >= threshold) {
        flagged.push({ employeeId, lateDays: counts.late, earlyLeaveDays: counts.early });
      }
    }

    return { lateCount, earlyCount, flagged };
  }
}
