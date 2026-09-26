export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const sstep = (a: number, b: number, v: number) => smooth(clamp((v - a) / (b - a)));

export type RGB = [number, number, number];
export type Stops = [number, RGB][];

/** يستوفي لوناً بين نقاط توقف عند تقدم p */
export function colorAt(stops: Stops, p: number): RGB {
  let i = 0;
  while (i < stops.length - 2 && p > stops[i + 1][0]) i++;
  const [p0, a] = stops[i];
  const [p1, b] = stops[i + 1];
  const t = smooth(clamp((p - p0) / (p1 - p0)));
  return a.map((v, k) => Math.round(v + (b[k] - v) * t)) as RGB;
}

export const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** تقدم التمرير داخل قسم sticky: 0 عند دخوله و1 عند نهايته */
export function sectionProgress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    p: clamp(-r.top / Math.max(1, r.height - innerHeight)),
    visible: r.bottom > 0 && r.top < innerHeight,
    covers: r.top <= 40 && r.bottom >= 40,
  };
}

/** لون الهيدر يتبع القسم الذي تحته */
export function setHeader(fg: string, bg: string) {
  const s = document.documentElement.style;
  s.setProperty('--hdr-fg', fg);
  s.setProperty('--hdr-bg', bg);
}
