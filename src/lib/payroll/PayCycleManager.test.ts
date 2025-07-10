import test from 'node:test';
import assert from 'node:assert/strict';
import { PayCycleManager } from './PayCycleManager';

test('PayCycleManager.getNextCycleDates returns one week range for weekly frequency', () => {
    const lastEnd = new Date('2025-07-01');
    const next = PayCycleManager.getNextCycleDates('weekly', lastEnd);
    assert.equal(next.start.toISOString().slice(0,10), '2025-07-02');
    assert.equal(next.end.toISOString().slice(0,10), '2025-07-08');
});
