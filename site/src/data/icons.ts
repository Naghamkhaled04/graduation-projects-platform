/** مجموعة أيقونات موحّدة: خطوط رفيعة بلون النص الحالي (currentColor). بديل عن الإيموجي */
const P: Record<string, string> = {
  health: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/><path d="M3.2 12h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3"/>',
  agri: '<path d="M7 20h10"/><path d="M12 20v-9"/><path d="M12 11c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6z"/><path d="M12 13c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
  energy: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  safety: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  transport: '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/>',
  water: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5 12 2.5C11.5 5 10 7.4 8 9.5 6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  robot: '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><path d="M8.5 13v2M15.5 13v2"/><path d="M1 13v3M23 13v3"/>',
  industry: '<path d="M2 21V9l6 4V9l6 4V4h4a2 2 0 0 1 2 2v15z"/><path d="M7 17h1M12 17h1M17 17h1"/>',
  ai: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  fly: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  store: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9h18"/><path d="M5 9v11h14V9"/><path d="M10 20v-5h4v5"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19l-6-10V3"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2"/><path d="M10 21v-4h4v4"/>',
  cross: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>',
  send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-9 0 10-3 16-9 16z"/><path d="M4 21c2-5 5-8 9-10"/>',
};
/** أيقونة بلون النص. `n` يُستعمل فقط لأيقونة المستوى (1..4 أعمدة ممتلئة) */
export function svg(name: string, size = 18, n = 0): string {
  const open = `<svg class="ic-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`;
  if (name === 'level') return open + [0, 1, 2, 3].map((i) => `<path d="M${5 + i * 5} 20v-${(i + 1) * 3.5}" opacity="${i < n ? 1 : 0.22}" stroke-width="2.6"/>`).join('') + '</svg>';
  return open + (P[name] ?? P.box) + '</svg>';
}
