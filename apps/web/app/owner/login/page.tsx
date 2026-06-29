import { redirect } from "next/navigation";

// 【方針: 一般ユーザ兼施設運営者】施設運営者専用ログインは廃止。一般ログインへ誘導し、
// ログイン後は運営者ダッシュボード /owner へ戻す。
export default function OwnerLoginPage() {
  redirect(`/login?redirect=${encodeURIComponent("/owner")}`);
}
