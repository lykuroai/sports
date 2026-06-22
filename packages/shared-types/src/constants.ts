import type {
  ApprovalType,
  EventStatus,
  Gender,
  ParticipantStatus,
  SkillLevel,
} from "./enums";

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  beginner: "初心者",
  intermediate: "中級",
  advanced: "上級",
  any: "レベル不問",
};

/** 利用者が自分の種目レベルとして選べる値（'any' は募集側専用なので除外）。 */
export const USER_SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced"];

/** 施設運営者の申請・承認状態のラベル（facility.facility_owners.status）。 */
export const OWNER_STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  verified: "承認済み",
  rejected: "却下",
  revoked: "取消",
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
  unspecified: "指定なし",
};

/** 年代の選択肢。account.profiles.age_range は text 列にこの値をそのまま格納する。 */
export const AGE_RANGE_OPTIONS = [
  "10代", "20代", "30代", "40代", "50代", "60代以上",
] as const;
export type AgeRange = (typeof AGE_RANGE_OPTIONS)[number];

/** 本人確認状態のバッジ表示。account.profiles.verification_status に対応。 */
export const VERIFICATION_STATUS_LABEL: Record<string, string> = {
  unverified: "未確認",
  pending: "確認中",
  verified: "本人確認済み",
  rejected: "未確認",
};

export const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  approval: "主催者承認制",
  first_come: "先着順",
  invite: "招待制",
  lottery: "抽選制",
  instant: "即時参加",
};

// MVP では承認制・先着順を優先（仕様 §6.3）
export const MVP_APPROVAL_TYPES: ApprovalType[] = ["approval", "first_come"];

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: "下書き",
  open: "募集中",
  few_left: "残りわずか",
  full: "満員",
  waitlist: "キャンセル待ち",
  closed: "募集終了",
  finished: "開催済み",
  cancelled: "中止",
  private: "非公開",
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  applied: "申請中",
  approved: "承認済み",
  rejected: "拒否",
  waitlist: "キャンセル待ち",
  cancelled_self: "本人キャンセル",
  cancelled_organizer: "主催者キャンセル",
  attended: "参加済み",
  absent: "欠席",
  no_show: "無断欠席",
};

export const REPORT_REASONS = [
  "虚偽の募集",
  "営利目的の不適切な勧誘",
  "宗教・ネットワークビジネスへの勧誘",
  "ハラスメント",
  "不適切なメッセージ",
  "なりすまし",
  "無断欠席",
  "不正な施設情報",
  "不適切な写真",
  "危険行為",
  "規約違反",
] as const;

export const USER_REVIEW_TAGS = [
  "時間を守った",
  "連絡が適切だった",
  "マナーが良かった",
  "初心者への配慮があった",
  "また一緒に参加したい",
] as const;

export const FACILITY_RATING_ASPECTS = [
  { key: "equipment_rating", label: "設備" },
  { key: "cleanliness_rating", label: "清潔さ" },
  { key: "access_rating", label: "アクセス" },
  { key: "price_rating", label: "料金" },
] as const;

export const GENDER_CONDITION_OPTIONS: { value: Gender; label: string }[] = [
  { value: "unspecified", label: "指定なし" },
  { value: "male", label: "男性のみ" },
  { value: "female", label: "女性のみ" },
];

/** 種目ドメインのメタ情報（サブドメイン・表示名・アイコン）。 */
export const SPORT_DOMAINS = [
  { slug: "golf", name: "ゴルフ", host: "golf-spotomo.lykuro.ai" },
  { slug: "running", name: "ランニング", host: "running-spotomo.lykuro.ai" },
  { slug: "outdoor", name: "アウトドア", host: "outdoor-spotomo.lykuro.ai" },
] as const;
