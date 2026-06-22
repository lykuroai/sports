// 施設運営者は無料（サブスク廃止）。Stripe 連携は削除済みで、公開 URL ヘルパーのみ残す
// （オーナー登録/ログインのコールバック先に使用）。
export const facilityOrigin = () =>
  process.env.NEXT_PUBLIC_FACILITY_URL ?? "http://localhost:3005";
