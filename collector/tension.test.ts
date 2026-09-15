import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { computeTension, tensionLevel } from '../shared/tension';
import type { Article, ConflictConfig } from '../shared/types';

const conflicts = JSON.parse(
  readFileSync(new URL('../shared/config/conflicts.json', import.meta.url), 'utf8'),
) as ConflictConfig[];

const NOW = Date.parse('2026-07-23T12:00:00Z');

function makeArticle(conflictIds: string[], hoursAgo: number, i: number): Article {
  return {
    id: `a${i}`,
    title: `Article ${i}`,
    link: `https://example.com/${i}`,
    source: 'Test',
    publishedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    summary: '',
    conflicts: conflictIds,
    regions: [],
    countries: [],
  };
}

test('no articles → zero tension, Calm', () => {
  const r = computeTension([], conflicts, NOW);
  assert.equal(r.global, 0);
  assert.equal(r.level, 'Calm');
  assert.ok(r.perConflict.every((c) => c.score === 0));
});

test('untagged articles produce no conflict tension', () => {
  const articles = Array.from({ length: 50 }, (_, i) => makeArticle([], 1, i));
  const r = computeTension(articles, conflicts, NOW);
  assert.equal(r.global, 0);
  assert.equal(r.conflictShare, 0);
});

test('more recent coverage → higher score than old coverage', () => {
  const fresh = Array.from({ length: 10 }, (_, i) => makeArticle(['sudan'], 2, i));
  const stale = Array.from({ length: 10 }, (_, i) => makeArticle(['sudan'], 144, i));
  const freshScore = computeTension(fresh, conflicts, NOW).perConflict[0];
  const staleScore = computeTension(stale, conflicts, NOW).perConflict[0];
  assert.equal(freshScore.id, 'sudan');
  assert.ok(freshScore.score > staleScore.score);
});

test('score saturates below 100 and never exceeds it', () => {
  const flood = Array.from({ length: 500 }, (_, i) => makeArticle(['russia-ukraine'], 1, i));
  const r = computeTension(flood, conflicts, NOW);
  const top = r.perConflict[0];
  assert.equal(top.id, 'russia-ukraine');
  assert.ok(top.score >= 95 && top.score <= 100);
  assert.ok(r.global <= 100);
});

test('global index blends hottest conflicts with conflict share of news', () => {
  // 20 conflict articles + 20 quiet ones → share 0.5.
  const articles = [
    ...Array.from({ length: 20 }, (_, i) => makeArticle(['israel-palestine'], 3, i)),
    ...Array.from({ length: 20 }, (_, i) => makeArticle([], 3, 100 + i)),
  ];
  const r = computeTension(articles, conflicts, NOW);
  assert.ok(Math.abs(r.conflictShare - 0.5) < 1e-9);
  const topMean =
    r.perConflict.slice(0, 5).reduce((s, c) => s + c.score, 0) / 5;
  assert.equal(r.global, Math.round(0.5 * topMean + 25));
});

test('per-conflict list covers every configured conflict, sorted by score', () => {
  const articles = [
    ...Array.from({ length: 12 }, (_, i) => makeArticle(['haiti'], 2, i)),
    ...Array.from({ length: 3 }, (_, i) => makeArticle(['syria'], 2, 50 + i)),
  ];
  const r = computeTension(articles, conflicts, NOW);
  assert.equal(r.perConflict.length, conflicts.length);
  assert.equal(r.perConflict[0].id, 'haiti');
  assert.equal(r.perConflict[1].id, 'syria');
  for (let i = 1; i < r.perConflict.length; i++) {
    assert.ok(r.perConflict[i - 1].score >= r.perConflict[i].score);
  }
});

test('tension levels map to the documented bands', () => {
  assert.equal(tensionLevel(0), 'Calm');
  assert.equal(tensionLevel(19), 'Calm');
  assert.equal(tensionLevel(20), 'Elevated');
  assert.equal(tensionLevel(45), 'High');
  assert.equal(tensionLevel(60), 'Severe');
  assert.equal(tensionLevel(80), 'Critical');
  assert.equal(tensionLevel(100), 'Critical');
});
