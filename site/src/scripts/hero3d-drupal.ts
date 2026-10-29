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

// خلفية الموقع ← كحلي الموقع (المرحلة ٢) ← خلفية الموقع من جديد (المرحلة ٣)،
// فالهيرو بيخلص بنفس لون القسم اللي تحته. بالوضع الليلي «خلفية الموقع» غامقة لحالها
const palette = (): Palette => {
  const paper = tok('--cream'), navy = tok('--green-2');
  const ink = tok('--fg'), ink2 = tok('--fg-2');
  const on: RGB = [233, 243, 248], on2: RGB = [185, 202, 219];
  return {
    bg: [[0, paper], [0.4, paper], [0.52, navy], [0.7, navy], [0.82, paper], [1, paper]],
    fg: [[0, ink], [0.4, ink], [0.52, on], [0.7, on], [0.82, ink], [1, ink]],
    fg2: [[0, ink2], [0.4, ink2], [0.52, on2], [0.7, on2], [0.82, ink2], [1, ink2]],
  };
};

const root = document.getElementById('hero3d');
if (root) initHero(root, { palette, header: false });
