export type Style = 'hospital' | 'home' | 'shop' | 'lab' | 'tower' | 'farm';

export interface Building {
  id: string;
  owner: string;
  name: string;
  sign: string;
  style: Style;
  color: string; // #RRGGBB
  projects: string[];
  plot: number;
  ownerName?: string;
  ownerPoints?: number;   // نقاط صاحب المبنى: تحدد قوة الإضاءة
  executed?: number;      // مشاريع نفّذها فعلاً (تجارب معتمدة بصور): تكبّر المبنى
  official?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
}
export type Draft = Pick<Building, 'name' | 'sign' | 'style' | 'color' | 'projects'>;

export const STYLES: { key: Style; label: string; icon: string }[] = [
  { key: 'hospital', label: 'مشفى', icon: 'cross' },
  { key: 'home', label: 'بيت', icon: 'home' },
  { key: 'shop', label: 'متجر', icon: 'store' },
  { key: 'lab', label: 'مختبر', icon: 'flask' },
  { key: 'tower', label: 'برج', icon: 'building' },
  { key: 'farm', label: 'مزرعة', icon: 'leaf' },
];
export const COLORS = ['#1a9e8f', '#0e3a63', '#7FA07A', '#3B6F73', '#18766a', '#6B5B95'];
export const MAX_PROJECTS = 6;
export const OFFICIAL_PLOTS = 4;

/** مواقع القطع: شبكة 6×6 مراكزها ±20 ±60 ±100، مرتبة بالقرب من مركز المدينة أولاً */
export const PITCH = 40;
export const PLOTS: [number, number][] = (() => {
  const c = [-100, -60, -20, 20, 60, 100];
  const all: [number, number][] = [];
  for (const x of c) for (const z of c) all.push([x, z]);
  const first: [number, number][] = [[-20, -20], [20, -20], [-20, 20], [20, 20]]; // مباني الفريق
  const rest = all
    .filter(([x, z]) => !first.some(([a, b]) => a === x && b === z))
    .sort((p, q) => Math.hypot(...p) - Math.hypot(...q) || Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  return [...first, ...rest];
})();

export const OFFICIAL: Building[] = [
  { id: 'off-hospital', owner: 'team', name: 'مشفى مشاريع', sign: 'المشفى الذكي', style: 'hospital', color: '#1a9e8f', plot: 0, official: true, projects: ['iv', 'vitals', 'ecg', 'fall', 'coma', 'medfridge'] },
  { id: 'off-home', owner: 'team', name: 'البيت الذكي', sign: 'البيت الذكي', style: 'home', color: '#1a9e8f', plot: 1, official: true, projects: ['home', 'meter', 'gas', 'water', 'lock', 'fire'] },
  { id: 'off-env', owner: 'team', name: 'الطبيعة والطاقة', sign: 'الطبيعة والطاقة', style: 'farm', color: '#7FA07A', plot: 2, official: true, projects: ['farm', 'solar', 'flood', 'weather', 'air', 'tank'] },
  { id: 'off-road', owner: 'team', name: 'الطرق والسلامة', sign: 'الطرق والسلامة', style: 'tower', color: '#1a9e8f', plot: 3, official: true, projects: ['traffic', 'street', 'park', 'crash', 'gate', 'guard'] },
];

/** تنظيف نصوص المستخدم قبل الاستعمال */
export const clean = (s: string, max: number) => s.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
