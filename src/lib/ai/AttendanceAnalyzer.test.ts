import test from 'node:test';
import assert from 'node:assert/strict';
import { AttendanceAnalyzer } from './AttendanceAnalyzer';
import type { AttendanceLog } from '@/types/database';

test('AttendanceAnalyzer.analyze flags employees with repeated late arrivals', () => {
    const logs: AttendanceLog[] = [
      { id: '1', employeeId: 'e1', projectId: 'p1', date: '2025-07-01', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'late', departureStatus: 'on-time' },
      { id: '2', employeeId: 'e1', projectId: 'p1', date: '2025-07-02', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'late', departureStatus: 'on-time' },
      { id: '3', employeeId: 'e2', projectId: 'p1', date: '2025-07-01', checkInTime: null, gpsLocationCheckIn: { lat: 0, lng: 0 }, arrivalStatus: 'on-time', departureStatus: 'left-early' },
    ] as any;
    const res = AttendanceAnalyzer.analyze(logs, 'high');
    assert.equal(res.flagged.length, 1);
    assert.equal(res.flagged[0].employeeId, 'e1');
});
