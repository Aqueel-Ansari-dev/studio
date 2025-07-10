import { describe, it, expect } from 'vitest';
import { PayCycleManager } from './PayCycleManager';

describe('PayCycleManager.getNextCycleDates', () => {
  it('returns one week range for weekly frequency', () => {
    const lastEnd = new Date('2025-07-01');
    const next = PayCycleManager.getNextCycleDates('weekly', lastEnd);
    expect(next.start.toISOString().slice(0,10)).toBe('2025-07-02');
    expect(next.end.toISOString().slice(0,10)).toBe('2025-07-08');
  });
});
