import { redirect } from "next/navigation";

// 【方針: 一般ユーザ兼施設運営者】施設運営者は一般会員の拡張権限のため、専用の登録は廃止。
// 一般の新規登録へ誘導する（登録後、施設詳細から運営権を申請できる）。
export default function OwnerRegisterPage() {
  redirect("/register");
}
