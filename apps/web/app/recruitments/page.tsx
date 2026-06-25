import { redirect } from "next/navigation";

// 画面遷移図の正規URL /recruitments（仲間募集一覧）→ 既存の募集一覧（/running）。
export default async function RecruitmentsAlias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  redirect(`/running${qs.toString() ? `?${qs.toString()}` : ""}`);
}
