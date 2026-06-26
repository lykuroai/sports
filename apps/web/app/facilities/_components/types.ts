// 施設の登録・修正申請フォームの共有 state（一般ユーザ /register と運営者 /submit で共用）。
export type SubmitState = { error: string | null; ok?: boolean };
