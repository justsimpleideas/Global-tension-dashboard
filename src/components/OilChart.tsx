import { useMemo, useState } from 'react';
import type { MarketsData, OilSeries } from '../../shared/types';

const W = 720;
const H = 240;
const PAD = { l: 46, r: 66, t: 14, b: 26 };

const SERIES_COLOR: Record<string, string> = {
  brent: 'var(--chart-1)',
  wti: 'var(--chart-2)',
};

interface Layout {
  dates: string[];
  xFor: (date: string) => number;
  yFor: (value: number) => number;
  ticks: number[];
  paths: { series: OilSeries; d: string; lastX: number; lastY: number }[];
}

function buildLayout(oil: OilSeries[]): Layout | null {
  const dateSet = new Set<string>();
  let min = Infinity;
  let max = -Infinity;
  for (const s of oil) {
    for (const p of s.series) {
      dateSet.add(p.date);
      if (p.close < min) min = p.close;
      if (p.close > max) max = p.close;
    }
  }
  const dates = [...dateSet].sort();
  if (dates.length < 2 || !Number.isFinite(min)) return null;

  const span = Math.max(max - min, 1);
  min -= span * 0.06;
  max += span * 0.06;

  const dateIndex = new Map(dates.map((d, i) => [d, i]));
  const xFor = (date: string) =>
    PAD.l + ((dateIndex.get(date) ?? 0) / (dates.length - 1)) * (W - PAD.l - PAD.r);
  const yFor = (value: number) => PAD.t + ((max - value) / (max - min)) * (H - PAD.t - PAD.b);

  const step = Math.max(1, Math.round((max - min) / 4));
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max && ticks.length < 6; v += step) ticks.push(v);

  const paths = oil.map((series) => {
    const d = series.series
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.date).toFixed(1)} ${yFor(p.close).toFixed(1)}`)
      .join(' ');
    const last = series.series[series.series.length - 1];
    return { series, d, lastX: xFor(last.date), lastY: yFor(last.close) };
  });

  // Nudge end-of-line labels apart when the two lines finish close together.
  if (paths.length === 2 && Math.abs(paths[0].lastY - paths[1].lastY) < 14) {
    const [a, b] = paths[0].lastY <= paths[1].lastY ? [paths[0], paths[1]] : [paths[1], paths[0]];
    const mid = (a.lastY + b.lastY) / 2;
    a.lastY = mid - 7;
    b.lastY = mid + 7;
  }

  return { dates, xFor, yFor, ticks, paths };
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function OilChart({ markets }: { markets: MarketsData }) {
  const layout = useMemo(() => buildLayout(markets.oil), [markets]);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  if (!layout) return null;
  const { dates, xFor, yFor, ticks, paths } = layout;

  const xTickIdx = [0, Math.floor(dates.length / 3), Math.floor((2 * dates.length) / 3), dates.length - 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const t = (x - PAD.l) / (W - PAD.l - PAD.r);
    const idx = Math.min(dates.length - 1, Math.max(0, Math.round(t * (dates.length - 1))));
    setHoverDate(dates[idx]);
  };

  const hoverX = hoverDate ? xFor(hoverDate) : null;
  const hoverPoints = hoverDate
    ? paths
        .map(({ series }) => {
          const p = series.series.find((q) => q.date === hoverDate);
          return p ? { series, close: p.close } : null;
        })
        .filter((p): p is { series: OilSeries; close: number } => p !== null)
    : [];

  return (
    <section className="oil-card">
      <header className="oil-header">
        <div>
          <h3 className="oil-title">Crude Oil — 3-Month Trend</h3>
          <p className="oil-subtitle">
            Daily spot prices (USD per barrel) · {markets.source} · may lag a few days
          </p>
        </div>
        <div className="oil-legend">
          {markets.oil.map((s) => (
            <span key={s.id} className="oil-legend-item">
              <span className="oil-swatch" style={{ background: SERIES_COLOR[s.id] }} />
              <span className="oil-legend-name">{s.name}</span>
              <span className="oil-legend-price">${s.latest.toFixed(2)}</span>
              <span className={`oil-change ${s.change >= 0 ? 'up' : 'down'}`}>
                {s.change >= 0 ? '▲' : '▼'} {Math.abs(s.changePct).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </header>

      <div className="oil-chart-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="oil-chart"
          role="img"
          aria-label={`Crude oil price trend: ${markets.oil
            .map((s) => `${s.name} $${s.latest.toFixed(2)}`)
            .join(', ')}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverDate(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yFor(t)}
                y2={yFor(t)}
                className="oil-grid"
              />
              <text x={PAD.l - 8} y={yFor(t) + 3.5} className="oil-axis-label" textAnchor="end">
                ${t}
              </text>
            </g>
          ))}
          {xTickIdx.map((i) => (
            <text
              key={i}
              x={xFor(dates[i])}
              y={H - 8}
              className="oil-axis-label"
              textAnchor="middle"
            >
              {formatDate(dates[i])}
            </text>
          ))}

          {paths.map(({ series, d }) => (
            <path key={series.id} d={d} className="oil-line" stroke={SERIES_COLOR[series.id]} />
          ))}
          {paths.map(({ series, lastX, lastY }) => (
            <text key={series.id} x={lastX + 8} y={lastY + 3.5} className="oil-end-label">
              {series.name.replace(' Crude', '')}
            </text>
          ))}

          {hoverX !== null && (
            <g>
              <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={H - PAD.b} className="oil-crosshair" />
              {hoverPoints.map((p) => (
                <circle
                  key={p.series.id}
                  cx={hoverX}
                  cy={yFor(p.close)}
                  r={4}
                  className="oil-dot"
                  fill={SERIES_COLOR[p.series.id]}
                />
              ))}
            </g>
          )}
        </svg>
        {hoverDate && hoverPoints.length > 0 && (
          <div
            className="oil-tooltip"
            style={{
              left: `${((hoverX ?? 0) / W) * 100}%`,
              top: `${(Math.min(...hoverPoints.map((p) => yFor(p.close))) / H) * 100}%`,
            }}
          >
            <strong>{formatDate(hoverDate)}</strong>
            {hoverPoints.map((p) => (
              <span key={p.series.id}>
                <span className="oil-swatch" style={{ background: SERIES_COLOR[p.series.id] }} />
                {p.series.name.replace(' Crude', '')} ${p.close.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
