// Independent (blind) labelling of the 60 real posts, so the evaluation doesn't rest on one annotator.
import { REAL_SET } from './core/realset.js';
import { AREAS } from './core/gazetteer.js';
import { findPhones } from './core/extract.js';
import { esc } from './util.js';

const KEY = 'floodline.labels.v1';
let labels = {};
try { labels = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { labels = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(labels)); } catch { /* ignore */ } count(); };
const count = () => { document.getElementById('count').textContent = Object.values(labels).filter((l) => l.kind).length; };

const KINDS = [['request', 'Someone needs help'], ['offer', 'Offer / helpline number'], ['update', 'Update (e.g. now safe)'], ['noise', 'Other']];
const VUL = [['pregnant', 'pregnant / in labour'], ['medical', 'needs medical care'], ['infant', 'baby (under ~2)'], ['elderly', 'elderly'], ['disabled', 'cannot walk / disabled']];
const WATER = [['', 'not stated'], ['knee', 'knee'], ['waist', 'waist'], ['neck', 'neck / chest'], ['roof', 'on upper floor / terrace']];
const areaOpts = `<option value="">— not one of these / not stated —</option>${[...AREAS].sort((a, b) => a.name.localeCompare(b.name)).map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}`;

document.getElementById('list').innerHTML = REAL_SET.map((p, i) => {
  const l = labels[i] || {};
  const phones = findPhones(p.text);
  return `<div class="post${l.kind ? ' done' : ''}" data-i="${i}">
    <div class="t"><span class="muted mono">#${i + 1}</span> ${esc(p.text)}</div>
    <fieldset><legend>What is it?</legend>${KINDS.map(([v, t]) => `<label><input type="radio" name="k${i}" value="${v}" ${l.kind === v ? 'checked' : ''} data-f="kind"> ${t}</label>`).join('')}</fieldset>
    <fieldset><legend>Area</legend><select data-f="areaId">${areaOpts}</select></fieldset>
    <fieldset><legend>People</legend><input type="number" min="1" max="2000" data-f="people" value="${l.people ?? ''}" placeholder="not stated" style="width:7em"></fieldset>
    <fieldset><legend>Vulnerable</legend>${VUL.map(([v, t]) => `<label><input type="checkbox" value="${v}" ${l.vulnerable?.includes(v) ? 'checked' : ''} data-f="vulnerable"> ${t}</label>`).join('')}</fieldset>
    <fieldset><legend>Water</legend>${WATER.map(([v, t]) => `<label><input type="radio" name="w${i}" value="${v}" ${(l.water ?? '') === v && l.kind ? 'checked' : ''} data-f="water"> ${t}</label>`).join('')}</fieldset>
    <fieldset><legend>Family's phone(s)</legend>${phones.length ? phones.map((ph) => `<label><input type="checkbox" value="${ph}" ${l.phones?.includes(ph) ? 'checked' : ''} data-f="phones"> ${ph}</label>`).join('') : '<span class="muted">no mobile number found</span>'}</fieldset>
  </div>`;
}).join('');
document.querySelectorAll('.post').forEach((el) => { const i = el.dataset.i; const sel = el.querySelector('select'); sel.value = labels[i]?.areaId || ''; });

document.getElementById('list').addEventListener('change', (e) => {
  const post = e.target.closest('.post'); if (!post) return;
  const i = post.dataset.i; const l = labels[i] ||= { vulnerable: [], phones: [] };
  const f = e.target.dataset.f;
  if (f === 'kind' || f === 'water') l[f] = e.target.value || null;
  else if (f === 'areaId') l.areaId = e.target.value || null;
  else if (f === 'people') l.people = e.target.value ? Number(e.target.value) : null;
  else if (f === 'vulnerable' || f === 'phones') l[f] = [...post.querySelectorAll(`input[data-f="${f}"]:checked`)].map((x) => x.value);
  post.classList.toggle('done', !!l.kind);
  save();
});
document.getElementById('export').addEventListener('click', () => {
  const out = REAL_SET.map((p, i) => ({ i, ...(labels[i] || {}) }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ labeller: 'Nethra R', at: new Date().toISOString(), labels: out }, null, 1)], { type: 'application/json' }));
  a.download = 'floodline-labels-nethra.json'; a.click();
});
count();
