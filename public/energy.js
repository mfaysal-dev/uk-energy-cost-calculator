// Appliance electricity running cost. Default unit rates are Ofgem's average price cap figures for people who pay
// by Direct Debit in England, Scotland and Wales:
// https://www.ofgem.gov.uk/information-consumers/energy-advice-households/get-energy-price-cap-standing-charges-and-unit-rates-region
// (checked 8 October 2026). Electricity has no VAT from 1 October 2026 to 31 March 2027.

export const CAP_PERIODS = [
  { id: '2026-q4', from: '2026-10-01', to: '2026-12-31', label: '1 Oct – 31 Dec 2026', unit: 26.32, standing: 54.83, note: 'No VAT on electricity in this period' },
  { id: '2026-q3', from: '2026-07-01', to: '2026-09-30', label: '1 Jul – 30 Sep 2026', unit: 26.11, standing: 57.19, note: 'Includes 5% VAT' },
];

// Typical power ratings, as examples only: check the rating plate or manual for your own appliance.
export const PRESETS = [
  { id: 'kettle', name: 'Kettle', watts: 3000, mins: 15 },
  { id: 'oven', name: 'Electric oven', watts: 2400, mins: 60 },
  { id: 'washer', name: 'Washing machine (per cycle avg.)', watts: 700, mins: 60 },
  { id: 'dryer', name: 'Tumble dryer', watts: 2500, mins: 60 },
  { id: 'dishwasher', name: 'Dishwasher (per cycle avg.)', watts: 1000, mins: 60 },
  { id: 'heater', name: 'Electric heater', watts: 2000, mins: 120 },
  { id: 'airfryer', name: 'Air fryer', watts: 1500, mins: 20 },
  { id: 'microwave', name: 'Microwave', watts: 900, mins: 10 },
  { id: 'tv', name: 'TV', watts: 100, mins: 240 },
  { id: 'laptop', name: 'Laptop', watts: 60, mins: 360 },
  { id: 'fridge', name: 'Fridge freezer (avg. draw)', watts: 40, mins: 1440 },
  { id: 'shower', name: 'Electric shower', watts: 9000, mins: 10 },
  { id: 'bulb', name: 'LED bulb', watts: 8, mins: 300 },
  { id: 'dehumidifier', name: 'Dehumidifier', watts: 250, mins: 360 },
];

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export function capFor(dateISO) {
  return CAP_PERIODS.find((p) => dateISO >= p.from && dateISO <= p.to) || CAP_PERIODS[0];
}

/** kWh used: watts × hours ÷ 1000 */
export function kwh(watts, hours) { return r4((Math.max(0, +watts || 0) * Math.max(0, +hours || 0)) / 1000); }

/** Cost in pence */
export function costPence(watts, hours, unitPence) { return (Math.max(0, +watts || 0) * Math.max(0, +hours || 0) / 1000) * Math.max(0, +unitPence || 0); }

/**
 * One appliance: watts, minutes per day of use, days per week. Returns kWh and £ per use-day, week, month, year.
 * Month = year ÷ 12. Year = 52.143 weeks (365 ÷ 7).
 */
export function appliance({ watts, minsPerDay, daysPerWeek = 7, unitPence }) {
  const hoursDay = Math.max(0, +minsPerDay || 0) / 60;
  const d = Math.max(0, Math.min(7, +daysPerWeek || 0));
  const dayKwh = (Math.max(0, +watts || 0) * hoursDay) / 1000;
  const yearKwh = dayKwh * d * (365 / 7);
  const p = Math.max(0, +unitPence || 0) / 100;
  return {
    perHourPence: r2(((+watts || 0) / 1000) * (+unitPence || 0)),
    dayKwh: r4(dayKwh), weekKwh: r4(dayKwh * d), yearKwh: r2(yearKwh),
    day: r2(dayKwh * p), week: r2(dayKwh * d * p), month: r2((yearKwh / 12) * p), year: r2(yearKwh * p),
  };
}

export function total(items, unitPence) {
  const rows = items.map((it) => ({ ...it, ...appliance({ ...it, unitPence }) }));
  const sum = (k) => r2(rows.reduce((a, r) => a + r[k], 0));
  return { rows, week: sum('week'), month: sum('month'), year: sum('year'), yearKwh: sum('yearKwh') };
}

/** Yearly standing charge in £ from pence per day */
export function standingYear(pencePerDay) { return r2((Math.max(0, +pencePerDay || 0) * 365) / 100); }
