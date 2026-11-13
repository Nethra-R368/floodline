// Leaflet map of cases. Pins are locality-level, spread a little so a street's cases don't stack.
import { hashJitter } from './util.js';

const COLORS = () => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return { critical: v('--critical'), high: v('--high'), medium: v('--medium'), low: v('--low'), done: v('--done') };
};

export function createMap(el, onOpen) {
  if (!window.L) {
    el.innerHTML = '<p class="empty">Map could not load (offline?). The queue still works.</p>';
    return { update() {}, resize() {}, focus() {} };
  }
  const L = window.L;
  const map = L.map(el, { zoomControl: true, attributionControl: true }).setView([13.03, 80.215], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  const markers = new Map();
  let colors = COLORS();
  // Keep tiles filling the panel when the layout changes (mobile tabs, window resize), and keep
  // Chennai in view until the volunteer pans or zooms themselves.
  const CHENNAI = [[12.86, 80.06], [13.22, 80.33]];
  let userMoved = false;
  map.on('dragstart', () => { userMoved = true; });
  el.addEventListener('wheel', () => { userMoved = true; }, { passive: true });
  el.querySelector('.leaflet-control-zoom')?.addEventListener('click', () => { userMoved = true; });
  const refit = () => { map.invalidateSize(); if (!userMoved && el.clientWidth > 50 && el.clientHeight > 50) map.fitBounds(CHENNAI); };
  if (window.ResizeObserver) new ResizeObserver(refit).observe(el);
  refit();

  return {
    update(cases) {
      colors = COLORS();
      const seen = new Set();
      for (const c of cases) {
        if (c.lat == null) continue;
        seen.add(c.id);
        const done = c.status === 'rescued' || c.status === 'unreachable';
        const color = done ? colors.done : colors[c.tier];
        const [dLat, dLng] = hashJitter(c.id, 0.006);
        const radius = 5 + Math.min(9, c.people || 2);
        let m = markers.get(c.id);
        if (!m) {
          m = L.circleMarker([c.lat + dLat, c.lng + dLng], { radius, weight: 2 }).addTo(map);
          m.on('click', () => onOpen(c.id));
          markers.set(c.id, m);
        }
        m.setStyle({ color, fillColor: color, fillOpacity: done ? 0.25 : 0.75, opacity: done ? 0.5 : 1, radius });
        m.setRadius(radius);
        m.bindTooltip(`${c.people ? `${c.people} people · ` : ''}${c.areaName}${c.vulnerable.length ? ` · ${c.vulnerable.join(', ')}` : ''} · ${c.status}`);
        if (!done && c.tier === 'critical') m.bringToFront();
      }
      for (const [id, m] of markers) if (!seen.has(id)) { m.remove(); markers.delete(id); }
    },
    resize() { setTimeout(() => map.invalidateSize(), 50); },
    focus(c) { if (c && c.lat != null) { userMoved = true; map.setView([c.lat, c.lng], Math.max(map.getZoom(), 13)); } },
  };
}
