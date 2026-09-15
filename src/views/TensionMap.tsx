import { useState } from 'react';
import type { TensionReport } from '../../shared/tension';
import { conflictById, conflicts } from '../lib/newsData';
import { LAND_PATH, lonLatToXY, MAP_HEIGHT, MAP_WIDTH } from '../lib/worldMapPath';

const R_MIN = 7;
const R_MAX = 30;

function radius(score: number): number {
  // Area-proportional sizing so a 4x score reads as 4x the ink, not 4x the width.
  return R_MIN + Math.sqrt(score / 100) * (R_MAX - R_MIN);
}

interface Hover {
  id: string;
  xPct: number;
  yPct: number;
}

export function TensionMap({
  report,
  onSelectConflict,
}: {
  report: TensionReport;
  onSelectConflict: () => void;
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  const active = report.perConflict.filter((c) => c.score > 0);
  const quiet = report.perConflict.filter((c) => c.score === 0);
  const hoverTension = hover ? report.perConflict.find((c) => c.id === hover.id) : null;
  const hoverConflict = hover ? conflictById.get(hover.id) : null;

  return (
    <div className="view">
      <section className="tension-panel">
        <div className="tension-score">
          <div className="tension-value">
            {report.global}
            <span className="tension-max">/100</span>
          </div>
          <div className="tension-level">{report.level}</div>
        </div>
        <div className="tension-meter-wrap">
          <div
            className="tension-meter"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={report.global}
            aria-label="Global tension index"
          >
            <div className="tension-meter-fill" style={{ width: `${report.global}%` }} />
            {[20, 40, 60, 80].map((t) => (
              <span key={t} className="tension-tick" style={{ left: `${t}%` }} />
            ))}
          </div>
          <p className="tension-caption">
            Global Tension Index — {Math.round(report.conflictShare * 100)}% of current world
            coverage is conflict-related, across {active.length} active hotspot
            {active.length === 1 ? '' : 's'}.
          </p>
          <details className="tension-how">
            <summary>How is this calculated?</summary>
            <p>
              Each conflict scores 0–100 from its article volume weighted by recency (48-hour
              half-life, saturating curve). The global index is 50% the average of the five
              hottest conflicts plus 50% the share of all collected articles that are
              conflict-tagged. Deterministic, no AI — see <code>shared/tension.ts</code>.
            </p>
          </details>
        </div>
      </section>

      <section className="tension-map-card">
        <div className="tension-map-container">
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="tension-map"
            role="img"
            aria-label="World map of conflict hotspots"
          >
            <path d={LAND_PATH} className="map-land" />
            {quiet.map((c) => {
              const conflict = conflictById.get(c.id);
              if (!conflict) return null;
              const [x, y] = lonLatToXY(conflict.epicenter.lon, conflict.epicenter.lat);
              return <circle key={c.id} cx={x} cy={y} r={3} className="map-dot-quiet" />;
            })}
            {[...active].reverse().map((c, i) => {
              const conflict = conflictById.get(c.id);
              if (!conflict) return null;
              const [x, y] = lonLatToXY(conflict.epicenter.lon, conflict.epicenter.lat);
              const r = radius(c.score);
              return (
                <g
                  key={c.id}
                  className="map-hotspot"
                  onMouseEnter={() =>
                    setHover({ id: c.id, xPct: (x / MAP_WIDTH) * 100, yPct: (y / MAP_HEIGHT) * 100 })
                  }
                  onMouseLeave={() => setHover(null)}
                  onClick={onSelectConflict}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    className="map-pulse"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  />
                  <circle cx={x} cy={y} r={r} className="map-circle-halo" />
                  <circle cx={x} cy={y} r={r} className="map-circle" />
                  <circle cx={x} cy={y} r={2.5} className="map-circle-core" />
                  <title>{`${conflict.name} — Tension ${c.score}/100, ${c.articleCount} Articles`}</title>
                </g>
              );
            })}
          </svg>
          {hover && hoverConflict && hoverTension && (
            <div
              className="map-tooltip"
              style={{ left: `${hover.xPct}%`, top: `${hover.yPct}%` }}
            >
              <strong>{hoverConflict.name}</strong>
              <span>
                Tension {hoverTension.score}/100 · {hoverTension.articleCount} Articles
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="tension-list">
        {report.perConflict.map((c, i) => {
          const conflict = conflictById.get(c.id);
          if (!conflict) return null;
          return (
            <button key={c.id} className="tension-row" onClick={onSelectConflict}>
              <span className="tension-rank">{i + 1}</span>
              <span className="tension-row-name">{conflict.name}</span>
              <span className="tension-bar">
                <span className="tension-bar-fill" style={{ width: `${c.score}%` }} />
              </span>
              <span className="tension-row-score">{c.score}</span>
              <span className="tension-row-count">{c.articleCount} Articles</span>
            </button>
          );
        })}
        <p className="view-intro tension-footnote">
          Hotspot positions come from <code>shared/config/conflicts.json</code> ·{' '}
          {conflicts.length} conflicts tracked. Click a row to open the Conflict Tracker.
        </p>
      </section>
    </div>
  );
}
