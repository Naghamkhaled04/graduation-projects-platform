import raw from './projects.json';

export interface BomRow extends Array<string> {}
export interface Project {
  id: string;
  c: string; // الفئة
  l: 'e' | 'm' | 'h'; // مفتاح المستوى
  ln: 'سهل' | 'متوسط' | 'متقدم';
  t: string; // العنوان
  d: string; // الوصف
  p: string[]; // وسوم القطع
  cost: string;
  prob: string;
  feat: string[];
  bom: string[][]; // [الاسم، الكمية، السعر، قسم المتجر]
  leg?: string[][];
  x?: boolean; // حصرية
}

export const projects = raw as Project[];
export const levels = ['سهل', 'متوسط', 'متقدم'] as const;
export const byId = (id: string) => projects.find((p) => p.id === id);
