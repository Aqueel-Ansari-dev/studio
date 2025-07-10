import type { AttendanceLog, PayrollRecord, Project, Task } from '@/types/database';
import { AttendanceAnalyzer } from './AttendanceAnalyzer';
import { TaskPredictor } from './TaskPredictor';
import { PayrollForecaster } from './PayrollForecaster';

export interface Recommendation {
  message: string;
  category: 'attendance' | 'task' | 'payroll';
  confidence: number;
}

/**
 * Generate simple recommendations based on attendance, tasks and payroll data.
 */
export class RecommendationEngine {
  static generate(
    attendance: AttendanceLog[],
    project: Project,
    tasks: Task[],
    payroll: PayrollRecord[],
  ): Recommendation[] {
    const recs: Recommendation[] = [];

    const attendanceRes = AttendanceAnalyzer.analyze(attendance);
    if (attendanceRes.flagged.length > 0) {
      recs.push({
        message: `${attendanceRes.flagged.length} employees late ${attendanceRes.flagged[0].lateDays} times`,
        category: 'attendance',
        confidence: 0.7,
      });
    }

    const risk = TaskPredictor.predict(project, tasks);
    if (risk.riskLevel === 'at-risk') {
      recs.push({
        message: `Project ${project.name} may miss deadline`,
        category: 'task',
        confidence: 0.8,
      });
    }

    const forecast = PayrollForecaster.forecast(payroll);
    if (forecast > 0) {
      recs.push({
        message: `Upcoming payroll expected around ₹${forecast}`,
        category: 'payroll',
        confidence: 0.6,
      });
    }

    return recs;
  }
}
