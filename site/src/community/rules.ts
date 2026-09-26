/** قواعد النقاط (قرار المستخدم ٢٢ سبتمبر ٢٠٢٦). الأرقام نفسها بسكربت SQL (docs/community-backend.md): غيّروا الاثنين معاً.
 *  تعليق على الفكرة (بلا صور) = 2 | تجربة بصور من التنفيذ = 10 | نشر مبنى بالمدينة = 5 | 50 نقطة = استشارة مجانية
 *  لا سقف على التعليقات؛ الحد الطبيعي تعليق واحد لكل مشروع
 *  دعوة صديق: +10 للداعي و+5 للمدعو، تنزل عند اعتماد **أول محتوى** للمدعو (لا عند التسجيل)، بسقف 10 أصدقاء */
export const POINTS = { ideaComment: 2, photoFeedback: 10, building: 5, redeemCost: 50, invite: 10, welcome: 5, inviteCap: 10 } as const;

export const REASON_LABEL: Record<string, string> = {
  feedback_photo: 'تجربة بصور',
  idea_comment: 'تعليق على فكرة',
  feedback_approved: 'اعتماد فيدباك',
  building_approved: 'اعتماد مبناك بالمدينة',
  invite: 'صديق دعوته صار نشطاً',
  welcome: 'ترحيب: انضممت بدعوة صديق',
  redeem: 'استبدال استشارة مجانية',
};
export const reasonLabel = (r: string) => REASON_LABEL[r] ?? (r.startsWith('admin') ? 'تعديل من الإدارة' : r);

/** رتب حسب النقاط */
export const LEVELS = [
  { min: 0, name: 'مبتدئ' },
  { min: 20, name: 'مساهم' },
  { min: 50, name: 'صانع' },
  { min: 120, name: 'خبير' },
] as const;
export const levelOf = (pts: number) => { const i = LEVELS.map((l) => pts >= l.min).lastIndexOf(true); return { ...LEVELS[i], n: i + 1 }; };
