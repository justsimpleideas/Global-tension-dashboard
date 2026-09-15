import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { ConflictConfig, RegionConfig } from '../shared/types';
import { buildCountryMatchers, matchConflicts, matchRegions } from './classify';

const conflicts = JSON.parse(
  readFileSync(new URL('../shared/config/conflicts.json', import.meta.url), 'utf8'),
) as ConflictConfig[];
const regions = JSON.parse(
  readFileSync(new URL('../shared/config/regions.json', import.meta.url), 'utf8'),
) as RegionConfig[];
const matchers = buildCountryMatchers(regions);

test('russia-ukraine: strong keyword match', () => {
  const ids = matchConflicts('Russian drones strike Kyiv overnight', conflicts);
  assert.ok(ids.includes('russia-ukraine'));
});

test('russia-ukraine: pair match (both sides mentioned)', () => {
  const ids = matchConflicts('Putin says Moscow is open to talks with Ukraine', conflicts);
  assert.ok(ids.includes('russia-ukraine'));
});

test('unrelated text matches no conflict', () => {
  const ids = matchConflicts('Bakery in Lyon wins international croissant award', conflicts);
  assert.equal(ids.length, 0);
});

test('yemen: strikes on Houthis tagged, iran not dragged in', () => {
  const ids = matchConflicts('US strikes Houthi targets in Yemen after shipping attack', conflicts);
  assert.ok(ids.includes('yemen-red-sea'));
  assert.ok(!ids.includes('iran-tensions'));
});

test('north korea single keyword is enough', () => {
  const ids = matchConflicts('North Korea fires ballistic missile toward the sea', conflicts);
  assert.ok(ids.includes('korean-peninsula'));
});

test('an article can belong to multiple conflicts', () => {
  const ids = matchConflicts(
    'Iran-backed Houthis in Yemen threaten Israel over Gaza offensive',
    conflicts,
  );
  assert.ok(ids.includes('yemen-red-sea'));
  assert.ok(ids.includes('israel-palestine'));
});

test('country detection: Paris maps to France / Europe', () => {
  const r = matchRegions('Bakery in Paris wins international croissant award', matchers);
  assert.ok(r.countries.includes('FR'));
  assert.ok(r.regions.includes('europe'));
});

test('short uppercase aliases are case-sensitive', () => {
  const hit = matchRegions('The US announced new tariffs', matchers);
  assert.ok(hit.countries.includes('US'));
  const noHit = matchRegions('Bonus payments for household workers announced', matchers);
  assert.ok(!noHit.countries.includes('US'));
});

test('South Sudan does not tag Sudan', () => {
  const r = matchRegions('South Sudan peace deal signed in Juba', matchers);
  assert.ok(r.countries.includes('SS'));
  assert.ok(!r.countries.includes('SD'));
});

test('Papua New Guinea does not tag Guinea', () => {
  const r = matchRegions('Papua New Guinea hit by strong earthquake', matchers);
  assert.ok(r.countries.includes('PG'));
  assert.ok(!r.countries.includes('GN'));
});

test('Northern Ireland tags the UK, not Ireland', () => {
  const r = matchRegions('Northern Ireland assembly votes on budget', matchers);
  assert.ok(r.countries.includes('GB'));
  assert.ok(!r.countries.includes('IE'));
});

test('New Mexico does not tag Mexico', () => {
  const r = matchRegions('New Mexico wildfire forces evacuations', matchers);
  assert.ok(!r.countries.includes('MX'));
});

test('Niger does not tag Nigeria and vice versa', () => {
  const niger = matchRegions('Soldiers killed in ambush in Niger', matchers);
  assert.ok(niger.countries.includes('NE'));
  assert.ok(!niger.countries.includes('NG'));
  const nigeria = matchRegions('Nigeria launches new oil refinery', matchers);
  assert.ok(nigeria.countries.includes('NG'));
  assert.ok(!nigeria.countries.includes('NE'));
});

test('region hint is used only when no country is detected', () => {
  const hinted = matchRegions('Local election results announced', matchers, 'africa');
  assert.deepEqual(hinted.regions, ['africa']);
  assert.equal(hinted.countries.length, 0);
  const detected = matchRegions('Kenya election results announced', matchers, 'europe');
  assert.deepEqual(detected.regions, ['africa']);
});

test('multi-country story gets multiple regions', () => {
  const r = matchRegions('US and China hold trade talks in Geneva', matchers);
  assert.ok(r.countries.includes('US'));
  assert.ok(r.countries.includes('CN'));
  assert.ok(r.countries.includes('CH'));
  assert.ok(r.regions.includes('americas'));
  assert.ok(r.regions.includes('asia'));
});
