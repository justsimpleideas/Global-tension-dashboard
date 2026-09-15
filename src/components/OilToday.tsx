import { useEffect, useState } from 'react';
import {
  BENCHMARKS,
  daysBetween,
  formatCountdown,
  sessionStatus,
} from '../../shared/marketClock';
import type { MarketsData, OilSeries } from '../../shared/types';
import { timeAgo } from '../lib/newsData';

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const timeIn = (date: Date, timeZone?: string) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });

function publicationNote(series: OilSeries, sessionDate: string, markets: MarketsData, now: Date): string {
  const latest = series.series[series.series.length - 1]?.date;
  if (latest && latest >= sessionDate) return `Published in the daily history (${dayLabel(latest)}).`;
  const eia = markets.eia;
  // An EIA release carries prices through the day before it, so a session is
  // covered by the first release dated after it.
  if (!eia || eia.nextRelease <= sessionDate) {
    return `Daily history runs through ${latest ? dayLabel(latest) : '—'}; this close arrives in a later EIA release.`;
  }
  // EIA release dates are Washington dates, so count days on that calendar.
  const days = daysBetween(sessionStatus(BENCHMARKS.wti, now).sessionDate, eia.nextRelease);
  const when = days <= 0 ? 'today (EIA announces no release time)' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return `Daily history runs through ${latest ? dayLabel(latest) : '—'}; this close is expected with EIA's ${dayLabel(eia.nextRelease)} release — ${when}.`;
}

function BenchmarkToday({ series, markets, now }: { series: OilSeries; markets: MarketsData; now: Date }) {
  const benchmark = BENCHMARKS[series.id];
  if (!benchmark) return null;
  const s = sessionStatus(benchmark, now);
  const live = markets.live?.quotes.find((q) => q.id === series.id);
  const countdown = formatCountdown(s.nextSettlement.getTime() - now.getTime());
  const settleTime = `${timeIn(s.nextSettlement, benchmark.timeZone)} ${benchmark.zoneLabel} · ${timeIn(s.nextSettlement)} your time`;

  let state: 'pending' | 'settled' | 'closed';
  let headline: string;
  let detail: string;
  if (!s.tradingToday) {
    state = 'closed';
    headline = 'Market closed today';
    detail = `Next close settles ${dayLabel(s.nextSettlementDate)} in ${countdown} (${settleTime})`;
  } else if (!s.settledToday) {
    state = 'pending';
    headline = `Not settled yet — settles in ${countdown}`;
    detail = settleTime;
  } else {
    state = 'settled';
    headline = "Today's close is set";
    detail = `Next close settles ${dayLabel(s.nextSettlementDate)} in ${countdown}`;
  }

  return (
    <div className="oil-today-item">
      <div className="oil-today-head">
        <span className="oil-today-name">{series.name}</span>
        <span className="oil-today-session">
          {dayLabel(s.sessionDate)} · {benchmark.zoneLabel}
        </span>
      </div>
      <p className={`oil-today-status ${state}`}>
        <span className="oil-today-dot" aria-hidden="true" />
        {headline}
      </p>
      <p className="oil-today-detail">{detail}</p>
      {live && (
        <p className="oil-today-live">
          Live <strong>${live.price.toFixed(2)}</strong> · as of {timeAgo(live.asOf, now.getTime())}
          {live.stale && <span className="oil-today-stale"> · provider marked stale</span>}
        </p>
      )}
      {s.tradingToday && <p className="oil-today-detail">{publicationNote(series, s.sessionDate, markets, now)}</p>}
    </div>
  );
}

export function OilToday({ markets }: { markets: MarketsData }) {
  const now = useNow(30_000);
  return (
    <section className="oil-card oil-today">
      <header className="oil-header">
        <div>
          <h3 className="oil-title">Today's Close</h3>
          <p className="oil-subtitle">
            {markets.live
              ? `Live quotes from ${markets.live.provider}, fetched ${timeAgo(markets.live.fetchedAt, now.getTime())}`
              : 'Live quotes off — set OILPRICEAPI_KEY for intraday prices'}
            {' · '}exchange holidays not modeled
          </p>
        </div>
      </header>
      <div className="oil-today-grid">
        {markets.oil.map((series) => (
          <BenchmarkToday key={series.id} series={series} markets={markets} now={now} />
        ))}
      </div>
    </section>
  );
}
