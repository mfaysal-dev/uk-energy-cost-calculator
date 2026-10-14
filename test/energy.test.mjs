import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP_PERIODS, capFor, kwh, costPence, appliance, total, standingYear } from '../public/energy.js';

test('Ofgem cap 1 Oct – 31 Dec 2026: 26.32p/kWh, 54.83p a day (Direct Debit average)', () => {
  const p = capFor('2026-10-08');
  assert.equal(p.unit, 26.32);
  assert.equal(p.standing, 54.83);
  assert.equal(capFor('2026-08-01').unit, 26.11);
});

test('1,000 W for 1 hour = 1 kWh = 26.32p', () => {
  assert.equal(kwh(1000, 1), 1);
  assert.equal(costPence(1000, 1, 26.32), 26.32);
});

test('3 kW kettle for 4 minutes = 0.2 kWh = 5.264p', () => {
  assert.equal(kwh(3000, 4 / 60), 0.2);
  assert.ok(Math.abs(costPence(3000, 4 / 60, 26.32) - 5.264) < 1e-9);
});

test('2 kW heater, 3 hours a day, every day', () => {
  const a = appliance({ watts: 2000, minsPerDay: 180, daysPerWeek: 7, unitPence: 26.32 });
  assert.equal(a.dayKwh, 6);
  assert.equal(a.day, 1.58);      // 6 × £0.2632 = £1.5792
  assert.equal(a.week, 11.05);    // 42 kWh
  assert.equal(a.yearKwh, 2190);  // 6 × 365
  assert.equal(a.year, 576.41);   // 2,190 × £0.2632
  assert.equal(a.month, 48.03);
  assert.equal(a.perHourPence, 52.64);
});

test('Days per week scale the weekly cost', () => {
  const a = appliance({ watts: 2500, minsPerDay: 60, daysPerWeek: 2, unitPence: 26.32 });
  assert.equal(a.weekKwh, 5);
  assert.equal(a.week, 1.32);
});

test('Totals add up across appliances', () => {
  const t = total([{ watts: 1000, minsPerDay: 60, daysPerWeek: 7 }, { watts: 500, minsPerDay: 120, daysPerWeek: 7 }], 26.32);
  assert.equal(t.yearKwh, 730);
  assert.equal(t.year, 192.14);
});

test('Zero or blank input costs nothing', () => {
  assert.equal(appliance({ watts: 0, minsPerDay: 60, unitPence: 26.32 }).year, 0);
  assert.equal(appliance({ watts: 1000, minsPerDay: '', unitPence: 26.32 }).year, 0);
});

test('Standing charge for a year', () => {
  assert.equal(standingYear(54.83), 200.13);
});

test('Cap periods are in date order with no gaps', () => {
  assert.equal(CAP_PERIODS[0].from, '2026-10-01');
  assert.equal(CAP_PERIODS[1].to, '2026-09-30');
});
