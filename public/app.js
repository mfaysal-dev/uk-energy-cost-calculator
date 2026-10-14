import { CAP_PERIODS, PRESETS, appliance, total, standingYear } from './energy.js';
import { $, $$, bindActions, setParams } from './ui.js';

const gbp = (n) => '£' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pence = (p) => (p < 100 ? (Math.round(p * 10) / 10).toLocaleString('en-GB') + 'p' : gbp(p / 100));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, +v || 0));
const DIV = { year: 1, month: 12, week: 365 / 7 };
const DEFAULT_ITEMS = ['kettle', 'tv', 'washer', 'heater'].map((id) => { const p = PRESETS.find((x) => x.id === id); return { name: p.name, watts: p.watts, minsPerDay: p.mins, daysPerWeek: id === 'washer' ? 3 : id === 'heater' ? 5 : 7 }; });
const state = { cap: CAP_PERIODS[0].id, unit: CAP_PERIODS[0].unit, standing: CAP_PERIODS[0].standing, items: DEFAULT_ITEMS.map((i) => ({ ...i })), view: 'year', incStand: false };
const el = { cap: $('#cap'), unit: $('#unit'), standing: $('#standing'), list: $('#list'), preset: $('#preset'), incStand: $('#incStand') };
let last = null;

el.cap.innerHTML = CAP_PERIODS.map((p, i) => `<option value="${p.id}">Price cap ${p.label}${i === 0 ? ' (now)' : ''}</option>`).join('') + '<option value="custom">My own tariff</option>';
el.preset.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.watts.toLocaleString('en-GB')} W)</option>`).join('') + '<option value="custom">Custom appliance…</option>';

function readParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('cap') === 'custom' || CAP_PERIODS.some((p) => p.id === q.get('cap'))) state.cap = q.get('cap');
  const capP = CAP_PERIODS.find((p) => p.id === state.cap);
  if (capP) { state.unit = capP.unit; state.standing = capP.standing; }
  if (q.has('u')) state.unit = clamp(q.get('u'), 0, 200);
  if (q.has('sc')) state.standing = clamp(q.get('sc'), 0, 300);
  if (q.has('a')) {
    const items = q.get('a').split(';').map((s) => s.split('|')).filter((p) => p.length === 4)
      .map(([name, w, m, d]) => ({ name: name.slice(0, 60), watts: clamp(w, 0, 20000), minsPerDay: clamp(m, 0, 1440), daysPerWeek: clamp(d, 0, 7) })).slice(0, 30);
    state.items = items;
  }
  if (['year', 'month', 'week'].includes(q.get('view'))) state.view = q.get('view');
  state.incStand = q.get('sc1') === '1';
}
function writeParams() {
  const capP = CAP_PERIODS.find((p) => p.id === state.cap);
  setParams({ cap: state.cap !== CAP_PERIODS[0].id && state.cap, u: (!capP || capP.unit !== state.unit) && state.unit, sc: (!capP || capP.standing !== state.standing) && state.standing,
    a: state.items.map((i) => [i.name.replace(/[|;]/g, ' '), i.watts, i.minsPerDay, i.daysPerWeek].join('|')).join(';'), view: state.view !== 'year' && state.view, sc1: state.incStand });
}
function capHint() {
  const p = CAP_PERIODS.find((x) => x.id === state.cap);
  $('#capHint').textContent = p ? `Average for Direct Debit customers in England, Scotland and Wales, ${p.label}. ${p.note}.` : 'Enter the unit rate and standing charge shown on your bill.';
}
function renderList() {
  el.list.innerHTML = state.items.map((it, i) => `<div class="ap" data-i="${i}">
    <div class="top"><input type="text" value="${esc(it.name)}" data-k="name" aria-label="Appliance name" maxlength="60"><button type="button" class="rm" data-rm="${i}" aria-label="Remove ${esc(it.name)}">×</button></div>
    <div class="nums">
      <label>Watts<input type="number" inputmode="decimal" min="0" max="20000" value="${it.watts}" data-k="watts"></label>
      <label>Minutes a day<input type="number" inputmode="decimal" min="0" max="1440" value="${it.minsPerDay}" data-k="minsPerDay"></label>
      <label>Days a week<input type="number" inputmode="decimal" min="0" max="7" step="1" value="${it.daysPerWeek}" data-k="daysPerWeek"></label>
    </div>
    <div class="cost" id="cost${i}"></div>
  </div>`).join('') || '<p class="hint">No appliances yet. Add one below.</p>';
}
function syncInputs() {
  el.cap.value = state.cap; el.unit.value = state.unit; el.standing.value = state.standing; el.incStand.checked = state.incStand;
  $(`input[name=view][value="${state.view}"]`).checked = true;
  capHint(); renderList();
}

function update() {
  const t = total(state.items, state.unit);
  const stand = standingYear(state.standing);
  last = { t, stand };
  const d = DIV[state.view];
  const yearTotal = t.year + (state.incStand ? stand : 0);
  $('#bigLabel').textContent = `Running cost a ${state.view}`;
  $('#total').textContent = gbp(yearTotal / d);
  $('#summary').textContent = `${state.items.length} appliance${state.items.length === 1 ? '' : 's'} at ${state.unit}p per kWh${state.incStand ? `, plus a ${state.standing}p daily standing charge` : ''}.`;
  $('#sKwh').textContent = Math.round(t.yearKwh).toLocaleString('en-GB');
  $('#sStand').textContent = gbp(stand);
  t.rows.forEach((r, i) => { const c = $('#cost' + i); if (c) c.innerHTML = `<b>${pence(r.perHourPence)}</b> an hour · ${pence(r.day * 100)} a day of use · <b>${gbp(r.year)}</b> a year`; });
  $('#rows').innerHTML = t.rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="r">${pence(r.perHourPence)}</td><td class="r">${gbp(r.month)}</td><td class="r">${gbp(r.year)}</td></tr>`).join('')
    + (state.incStand ? `<tr><td>Standing charge</td><td class="r">–</td><td class="r">${gbp(stand / 12)}</td><td class="r">${gbp(stand)}</td></tr>` : '');
  $('#fMonth').textContent = gbp(yearTotal / 12); $('#fYear').textContent = gbp(yearTotal);

  const sorted = [...t.rows].sort((a, b) => b.year - a.year);
  const max = Math.max(...sorted.map((r) => r.year), 0.01);
  $('#bars').innerHTML = sorted.map((r, i) => `<div class="barrow${i === 0 ? ' current' : ''}"><span class="label">${esc(r.name)}</span><span class="track"><span class="fill" style="width:${(r.year / max * 100).toFixed(1)}%"></span></span><b>${gbp(r.year)}</b></div>`).join('') || '<p class="hint">Add an appliance to see the chart.</p>';
  $('#perHour').innerHTML = [10, 100, 500, 1000, 2000, 3000, 9000].map((w) => `<tr><td>${w.toLocaleString('en-GB')} W</td><td class="r">${(w / 1000).toLocaleString('en-GB')}</td><td class="r">${pence(appliance({ watts: w, minsPerDay: 60, unitPence: state.unit }).perHourPence)}</td></tr>`).join('');
  writeParams();
}

function resultText() {
  const { t, stand } = last;
  return [`Appliance running costs at ${state.unit}p/kWh (${CAP_PERIODS.find((p) => p.id === state.cap)?.label ? 'Ofgem cap ' + CAP_PERIODS.find((p) => p.id === state.cap).label : 'own tariff'})`,
    ...t.rows.map((r) => `${r.name}: ${gbp(r.year)} a year (${pence(r.perHourPence)} an hour)`),
    `Total: ${gbp(t.year)} a year · ${gbp(t.year / 12)} a month`, state.incStand ? `Standing charge: ${gbp(stand)} a year` : '', location.href].filter(Boolean).join('\n');
}

el.cap.addEventListener('change', () => {
  state.cap = el.cap.value;
  const p = CAP_PERIODS.find((x) => x.id === state.cap);
  if (p) { state.unit = p.unit; state.standing = p.standing; el.unit.value = p.unit; el.standing.value = p.standing; }
  capHint(); update();
});
el.unit.addEventListener('input', () => { state.unit = clamp(el.unit.value, 0, 200); const p = CAP_PERIODS.find((x) => x.id === state.cap); if (p && p.unit !== state.unit) { state.cap = 'custom'; el.cap.value = 'custom'; capHint(); } update(); });
el.standing.addEventListener('input', () => { state.standing = clamp(el.standing.value, 0, 300); update(); });
el.incStand.addEventListener('change', () => { state.incStand = el.incStand.checked; update(); });
$$('input[name=view]').forEach((i) => i.addEventListener('change', () => { state.view = i.value; update(); }));
el.list.addEventListener('input', (e) => {
  const k = e.target.dataset.k; const box = e.target.closest('.ap'); if (!k || !box) return;
  const it = state.items[+box.dataset.i];
  if (k === 'name') it.name = e.target.value.slice(0, 60);
  else it[k] = clamp(e.target.value, 0, { watts: 20000, minsPerDay: 1440, daysPerWeek: 7 }[k]);
  update();
});
el.list.addEventListener('click', (e) => {
  const i = e.target.dataset.rm; if (i == null) return;
  state.items.splice(+i, 1); renderList(); update();
});
$('#add').addEventListener('click', () => {
  if (state.items.length >= 30) return;
  const p = PRESETS.find((x) => x.id === el.preset.value);
  state.items.push(p ? { name: p.name, watts: p.watts, minsPerDay: p.mins, daysPerWeek: 7 } : { name: 'My appliance', watts: 1000, minsPerDay: 60, daysPerWeek: 7 });
  renderList(); update();
  el.list.lastElementChild?.querySelector(p ? 'input[data-k=watts]' : 'input[data-k=name]')?.focus();
});
bindActions({ result: resultText });

readParams(); syncInputs(); update();
