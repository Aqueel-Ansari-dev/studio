import { describe, it, expect } from 'vitest';
import { AttendanceAnalyzer } from './AttendanceAnalyzer';
import type { AttendanceLog } from '@/types/database';

describe('AttendanceAnalyzer.analyze', () => {
  it('flags employees with repeated late arrivals', () => {
    const logs: AttendanceLog[] = [
      { id: '1', employeeId: 'e1', projectId: 'p1', date: '2025-07-01', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'late', departureStatus: 'on-time' },
      { id: '2', employeeId: 'e1', projectId: 'p1', date: '2025-07-02', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'late', departureStatus: 'on-time' },
      { id: '3', employeeId: 'e2', projectId: 'p1', date: '2025-07-01', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'on-time', departureStatus: 'left-early' },
    ] as any;
    const res = AttendanceAnalyzer.analyze(logs, 'high');
    expect(res.flagged.length).toBe(1);
    expect(res.flagged[0].employeeId).toBe('e1');
  });
});
