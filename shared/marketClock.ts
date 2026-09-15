/**
 * When does each benchmark's daily closing price get set?
 *
 *   WTI   — NYMEX settlement, 2:30 pm America/New_York
 *   Brent — ICE Futures Europe settlement, 7:30 pm Europe/London
 *
 * Sessions run Monday–Friday in the exchange's own time zone. Exchange
 * holidays are not modeled, so a holiday reads as a normal session.
 * Time zones go through Intl, so daylight saving time is handled for free.
 */

export interface Benchmark {
  id: string;
  timeZone: string;
  zoneLabel: string;
  settleHour: number;
  settleMinute: number;
}

export const BENCHMARKS: Record<string, Benchmark> = {
  wti: { id: 'wti', timeZone: 'America/New_York', zoneLabel: 'New York', settleHour: 14, settleMinute: 30 },
  brent: { id: 'brent', timeZone: 'Europe/London', zoneLabel: 'London', settleHour: 19, settleMinute: 30 },
};

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string): ZonedParts {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, fmt);
  }
  const get = (type: string) =>
    Number(fmt!.formatToParts(date).find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** UTC instant for a wall-clock time in `timeZone`. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  // Two passes settle the offset even when the guess crosses a DST boundary.
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += target - asUtc;
  }
  return new Date(guess);
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Calendar arithmetic on a plain Y-M-D (no time zone involved). */
function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

export interface SessionStatus {
  /** Exchange-local date of the session this status is about (YYYY-MM-DD). */
  sessionDate: string;
  /** False on Saturday/Sunday in the exchange's time zone. */
  tradingToday: boolean;
  /** Today's close is already set. */
  settledToday: boolean;
  /** The next settlement still ahead of `now`. */
  nextSettlement: Date;
  /** Exchange-local date of `nextSettlement`. */
  nextSettlementDate: string;
}

export function sessionStatus(benchmark: Benchmark, now: Date): SessionStatus {
  const p = zonedParts(now, benchmark.timeZone);
  const today = addDays(p.year, p.month, p.day, 0);
  const tradingToday = today.weekday >= 1 && today.weekday <= 5;
  const settleAt = (y: number, m: number, d: number) =>
    zonedTimeToUtc(y, m, d, benchmark.settleHour, benchmark.settleMinute, benchmark.timeZone);

  const todaySettle = settleAt(today.year, today.month, today.day);
  const settledToday = tradingToday && now.getTime() >= todaySettle.getTime();

  let next = today;
  if (!tradingToday || settledToday) {
    next = addDays(today.year, today.month, today.day, 1);
    while (next.weekday === 0 || next.weekday === 6) {
      next = addDays(next.year, next.month, next.day, 1);
    }
  }

  return {
    sessionDate: isoDate(today.year, today.month, today.day),
    tradingToday,
    settledToday,
    nextSettlement: settleAt(next.year, next.month, next.day),
    nextSettlementDate: isoDate(next.year, next.month, next.day),
  };
}

/** "3h 12m", "45m", "2d 4h" — rounded up to the minute so it never reads 0m early. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Whole calendar days from `fromIso` to `toIso` (both YYYY-MM-DD). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}
