import test from 'node:test';
import assert from 'node:assert/strict';
import { RecommendationEngine } from './RecommendationEngine';
import type { AttendanceLog, PayrollRecord, Project, Task } from '@/types/database';

test('RecommendationEngine.generate returns recommendations when risk detected', () => {
    const attendance: AttendanceLog[] = [
      { id: '1', employeeId: 'e1', projectId: 'p1', date: '2025-07-01', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'late', departureStatus: 'on-time' },
      { id: '2', employeeId: 'e1', projectId: 'p1', date: '2025-07-02', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'late', departureStatus: 'on-time' },
    ] as any;
    const project: Project = { id: 'p1', name: 'Proj', description: '', status: 'active' } as any;
    const tasks: Task[] = [ { id: 't1', projectId: 'p1', assignedEmployeeId: 'e1', taskName: '', description: '', status: 'pending', createdAt: 'a', updatedAt: 'a', createdBy: 'a' } ];
    const payroll: PayrollRecord[] = [
      { id: '1', employeeId: 'e1', projectId: 'p1', payPeriod: { start: '2025-07-01', end: '2025-07-31' }, hoursWorked: 0, hourlyRate: 0, taskPay: 0, approvedExpenses: 0, grossPay: 0, deductions: [], netPay: 1000, generatedBy: 'a', generatedAt: '2025-07-31', taskIdsProcessed: [], expenseIdsProcessed: [], payrollStatus: 'approved' },
    ];
    const recs = RecommendationEngine.generate(attendance, project, tasks, payroll);
    assert.ok(recs.length > 0);
});
