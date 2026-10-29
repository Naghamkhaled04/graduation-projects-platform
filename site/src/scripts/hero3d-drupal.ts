import { initHero, type Palette } from './hero3d';
import type { RGB } from './theme';

/**
 * هيرو «من فكرة مشروع إلى مناقشة ناجحة» لموقع الدروبال (تشابك): نفس الحركة، بس بألوان الموقع
 * والهيدر بيضل زي باقي الصفحات. بيتبني لملف واحد: npm run build:hero3d ← dist-hero/hero3d-drupal.js
 */

// لون متغيّر من الثيم (أي صيغة) ← [r, g, b]
const probe = document.createElement('i');
probe.style.display = 'none';
const tok = (name: string): RGB => {
  if (!probe.isConnected) document.body.appendChild(probe);
  probe.style.color = `var(${name})`;
  const m = getComputedStyle(probe).color.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return [+m[0], +m[1], +m[2]];
};

// المرحلة الأولى بخلفية الموقع ونصّه (فاتح أو ليلي)، والكحلية بكحلي الموقع ونص فاتح
const palette = (): Palette => {
  const paper = tok('--cream'), navy = tok('--green-2'), deep = tok('--green-deep');
  const ink = tok('--fg'), ink2 = tok('--fg-2');
  const on: RGB = [233, 243, 248], on2: RGB = [185, 202, 219];
  return {
    bg: [[0, paper], [0.4, paper], [0.56, navy], [1, deep]],
    fg: [[0, ink], [0.4, ink], [0.56, on], [1, on]],
    fg2: [[0, ink2], [0.4, ink2], [0.56, on2], [1, on2]],
  };
};

const root = document.getElementById('hero3d');
if (root) initHero(root, { palette, header: false });
