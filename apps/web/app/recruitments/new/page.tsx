import { redirect } from "next/navigation";

// 画面遷移図の正規URL /recruitments/new → 既存の募集作成（/events/new）。
// 認証ゲートは最終遷移先 /events/new（proxy の保護プレフィックス）で効く。
export default async function RecruitmentNewAlias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  redirect(`/events/new${qs.toString() ? `?${qs.toString()}` : ""}`);
}
