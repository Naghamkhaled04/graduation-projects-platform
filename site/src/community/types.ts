export interface Profile {
  id: string; display_name: string; university?: string | null; major?: string | null;
  year?: number | null; bio?: string | null; role: 'student' | 'admin'; points: number;
  /** خاص: لا يظهر لأحد، للتحقق من الانتماء للجامعة فقط */
  student_id?: string | null;
  /** بريد الجامعة: تظهره الإدارة وتُستنتج منه الجامعة. ليس بريد الحساب */
  uni_email?: string | null;
  /** من دعاه، ولا يُحتسب إلا مرة واحدة عند أول محتوى معتمد */
  referred_by?: string | null;
  invite_paid?: boolean;
}
export interface Feedback {
  id: string; project_id: string; user_id: string; author?: string; rating: number; comment: string;
  images: string[]; status: 'pending' | 'approved' | 'rejected'; created_at: string;
}
export interface LedgerRow { id: string; delta: number; reason: string; created_at: string }
export interface Redemption { id: string; user_id: string; author?: string; code: string; status: 'open' | 'used' | 'cancelled'; created_at: string }
export interface PendingBuilding { id: string; name: string; sign: string; owner_id: string }
export interface Session { id: string; email?: string }

export interface FeedbackInput { project_id: string; rating: number; comment: string; images: string[] /* data URLs مضغوطة */ }

/** خيط واحد لكل طالب مع الإدارة */
export interface Msg { id: string; user_id: string; from_admin: boolean; body: string; read_at: string | null; created_at: string }
export interface Thread { user_id: string; name: string; last_body: string; last_at: string; unread: number }
