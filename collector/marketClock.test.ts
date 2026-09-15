import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BENCHMARKS,
  daysBetween,
  formatCountdown,
  sessionStatus,
  zonedTimeToUtc,
} from '../shared/marketClock';

test('zonedTimeToUtc handles daylight saving on both sides', () => {
  // New York: EDT (UTC-4) in September, EST (UTC-5) in January.
  assert.equal(zonedTimeToUtc(2026, 9, 15, 14, 30, 'America/New_York').toISOString(), '2026-09-15T18:30:00.000Z');
  assert.equal(zonedTimeToUtc(2026, 1, 15, 14, 30, 'America/New_York').toISOString(), '2026-01-15T19:30:00.000Z');
  // London: BST (UTC+1) in September, GMT in January.
  assert.equal(zonedTimeToUtc(2026, 9, 15, 19, 30, 'Europe/London').toISOString(), '2026-09-15T18:30:00.000Z');
  assert.equal(zonedTimeToUtc(2026, 1, 15, 19, 30, 'Europe/London').toISOString(), '2026-01-15T19:30:00.000Z');
});

test('before settlement on a weekday: today, not settled yet', () => {
  // Tue 2026-09-15 10:00 New York.
  const s = sessionStatus(BENCHMARKS.wti, new Date('2026-09-15T14:00:00Z'));
  assert.equal(s.sessionDate, '2026-09-15');
  assert.equal(s.tradingToday, true);
  assert.equal(s.settledToday, false);
  assert.equal(s.nextSettlement.toISOString(), '2026-09-15T18:30:00.000Z');
});

test('after settlement: settled, next is the following weekday', () => {
  // Tue 2026-09-15 15:00 New York.
  const s = sessionStatus(BENCHMARKS.wti, new Date('2026-09-15T19:00:00Z'));
  assert.equal(s.settledToday, true);
  assert.equal(s.nextSettlementDate, '2026-09-16');
});

test('Friday after settlement skips the weekend', () => {
  // Fri 2026-09-18 20:00 London.
  const s = sessionStatus(BENCHMARKS.brent, new Date('2026-09-18T19:00:00Z'));
  assert.equal(s.settledToday, true);
  assert.equal(s.nextSettlementDate, '2026-09-21');
  assert.equal(s.nextSettlement.toISOString(), '2026-09-21T18:30:00.000Z');
});

test('weekend: no session today', () => {
  // Sat 2026-09-19 noon New York.
  const s = sessionStatus(BENCHMARKS.wti, new Date('2026-09-19T16:00:00Z'));
  assert.equal(s.tradingToday, false);
  assert.equal(s.settledToday, false);
  assert.equal(s.nextSettlementDate, '2026-09-21');
});

test('session date follows the exchange, not UTC', () => {
  // 2026-09-16 01:00 UTC is still Tue 2026-09-15 21:00 in New York.
  const s = sessionStatus(BENCHMARKS.wti, new Date('2026-09-16T01:00:00Z'));
  assert.equal(s.sessionDate, '2026-09-15');
  assert.equal(s.settledToday, true);
});

test('formatCountdown picks the two largest units and rounds up', () => {
  assert.equal(formatCountdown(3 * 3600000 + 12 * 60000), '3h 12m');
  assert.equal(formatCountdown(45 * 60000 - 1), '45m');
  assert.equal(formatCountdown(2 * 86400000 + 4 * 3600000), '2d 4h');
  assert.equal(formatCountdown(-5), '0m');
});

test('daysBetween counts calendar days', () => {
  assert.equal(daysBetween('2026-09-15', '2026-09-16'), 1);
  assert.equal(daysBetween('2026-09-15', '2026-09-15'), 0);
});
