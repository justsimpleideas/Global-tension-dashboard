import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fredUrl,
  oilPriceApiUrl,
  parseEiaSchedule,
  parseFredCsv,
  parseOilPriceApi,
  toOilSeries,
} from './markets';

test('parseEiaSchedule reads release and next release dates', () => {
  const html =
    '<td>Release Date: 9/10/2026</td> <td>Next Release Date: 9/16/2026</td>';
  assert.deepEqual(parseEiaSchedule(html), { lastRelease: '2026-09-10', nextRelease: '2026-09-16' });
  assert.equal(parseEiaSchedule('<p>nothing here</p>'), null);
});

test('oilPriceApiUrl requests both benchmarks in one call', () => {
  assert.ok(oilPriceApiUrl().endsWith('by_code=BRENT_CRUDE_USD,WTI_USD'));
});

test('parseOilPriceApi handles the multi-code shape and prefers as_of', () => {
  const quotes = parseOilPriceApi({
    status: 'success',
    data: {
      prices: [
        { price: 74.523, code: 'BRENT_CRUDE_USD', created_at: '2026-09-15T15:30:00Z', as_of: '2026-09-15T15:25:00Z' },
        { price: 70.1, code: 'WTI_USD', created_at: '2026-09-15T15:30:00Z', stale: true },
        { price: 3.1, code: 'NATURAL_GAS_USD', created_at: '2026-09-15T15:30:00Z' },
      ],
    },
  });
  assert.deepEqual(quotes, [
    { id: 'brent', price: 74.52, asOf: '2026-09-15T15:25:00Z', stale: false },
    { id: 'wti', price: 70.1, asOf: '2026-09-15T15:30:00Z', stale: true },
  ]);
});

test('parseOilPriceApi handles the single-code shape and rejects bad payloads', () => {
  assert.equal(
    parseOilPriceApi({ status: 'success', data: { price: 70, code: 'WTI_USD', created_at: '2026-09-15T15:30:00Z' } }).length,
    1,
  );
  assert.deepEqual(parseOilPriceApi({ status: 'error', data: null }), []);
  assert.deepEqual(parseOilPriceApi({ status: 'success', data: { price: '70', code: 'WTI_USD' } }), []);
  assert.deepEqual(parseOilPriceApi(null), []);
});

const FRED_FIXTURE = [
  'observation_date,DCOILBRENTEU,DCOILWTICO',
  '2026-07-14,83.69,80.44',
  '2026-07-15,83.08,80.73',
  '2026-07-16,.,80.03',
  '2026-07-17,85.01,.',
  '2026-07-20,86.99,84.38',
  'garbage-row,1,2',
].join('\n');

test('parseFredCsv splits columns into per-series points and skips "." gaps', () => {
  const parsed = parseFredCsv(FRED_FIXTURE);
  assert.deepEqual(Object.keys(parsed).sort(), ['DCOILBRENTEU', 'DCOILWTICO']);
  assert.equal(parsed.DCOILBRENTEU.length, 4);
  assert.equal(parsed.DCOILWTICO.length, 4);
  assert.deepEqual(parsed.DCOILBRENTEU[2], { date: '2026-07-17', close: 85.01 });
  assert.deepEqual(parsed.DCOILWTICO[2], { date: '2026-07-16', close: 80.03 });
});

test('parseFredCsv tolerates empty or malformed input', () => {
  assert.deepEqual(parseFredCsv(''), {});
  assert.deepEqual(parseFredCsv('observation_date,X'), {});
  assert.deepEqual(parseFredCsv('observation_date,X\ngarbage'), { X: [] });
});

test('fredUrl requests both benchmarks with a bounded start date', () => {
  const url = fredUrl(new Date('2026-07-23T12:00:00Z'));
  assert.ok(url.includes('DCOILBRENTEU,DCOILWTICO'));
  assert.ok(url.includes('cosd=2026-04-14'));
});

test('toOilSeries computes latest price and day change', () => {
  const s = toOilSeries('brent', 'Brent Crude', [
    { date: '2026-07-17', close: 66.0 },
    { date: '2026-07-20', close: 67.65 },
  ]);
  assert.ok(s);
  assert.equal(s.latest, 67.65);
  assert.equal(s.change, 1.65);
  assert.equal(s.changePct, 2.5);
  assert.equal(s.unit, 'USD/bbl');
});

test('toOilSeries rejects series with fewer than two points', () => {
  assert.equal(toOilSeries('wti', 'WTI', [{ date: '2026-07-20', close: 63 }]), null);
  assert.equal(toOilSeries('wti', 'WTI', []), null);
});
