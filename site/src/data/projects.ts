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
  rank?: number; // ترتيب العرض: الأقوى أولاً (محسوب، وقابل للتعديل يدوياً)
  sw?: boolean; // مشروع برمجي: بدون قطع، التقنيات بدل قائمة القطع
}

/** الترتيب حسب rank: حصرية وعمق وبدائل وحجم السلّة، مع موازنة عشان أول شاشة ما تكون كلها متقدم ولا كلها مقفولة */
export const projects = (raw as Project[]).slice().sort((a, b) => (a.rank ?? 9e9) - (b.rank ?? 9e9));
export const levels = ['سهل', 'متوسط', 'متقدم'] as const;
export const byId = (id: string) => projects.find((p) => p.id === id);
