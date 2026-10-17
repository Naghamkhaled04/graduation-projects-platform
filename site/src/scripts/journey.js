// رحلة ألوان صفحة التعريف: فاتح ← كحلي (مين نحن) ← فاتح. دوال صافية عشان تنفحص بـnode:test.

const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 0 = فاتح، 1 = كحلي. التغيير بالفراغ بين "فكرتنا" و"هدفنا"، والرجوع للفاتح قبل ما يوصل عنوان "ليش نحنا" */
export const darkness = (qIdea, qWhy) => ss(0.36, 0.56, qIdea) * (1 - ss(0, 0.12, qWhy));

// [فاتح, غامق] لكل لون
const PALETTE = {
  bg: [[233, 243, 248], [7, 26, 51]],
  fg: [[14, 58, 99], [233, 243, 248]],
  fg2: [[74, 99, 128], [185, 202, 219]],
  muted: [[111, 132, 153], [127, 154, 179]],
  neon: [[26, 158, 143], [61, 183, 166]],
  panel: [[255, 255, 255], [7, 26, 51]],
  dot: [[14, 58, 99], [233, 243, 248]],
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const lum = (c) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (x, y) => { const [h, l] = [lum(x), lum(y)].sort((p, q) => q - p); return (h + 0.05) / (l + 0.05); };

/** متغيرات CSS (--in-*) عند درجة غمق d. الخلفية بتتدرج، والنص بياخد الطرف (فاتح أو غامق) اللي تباينه أعلى مع الخلفية هاللحظة */
export function themeVars(d) {
  const bg = mix(PALETTE.bg[0], PALETTE.bg[1], d);
  const text = contrast(PALETTE.fg[1], bg) > contrast(PALETTE.fg[0], bg) ? 1 : 0;
  const out = {};
  for (const [k, [a, b]] of Object.entries(PALETTE)) {
    const t = k === 'bg' || k === 'panel' || k === 'dot' ? d : text;
    out['--in-' + k] = `rgb(${mix(a, b, t).join(' ')})`;
  }
  return out;
}
