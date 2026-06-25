import { redirect } from "next/navigation";

// 画面遷移図(spotomo_top_screen_transition_diagram)の正規URL /sports/{sport_code} を
// 既存の種目ページへ橋渡しするエイリアス。running は統合サイト内、golf/outdoor は移行期
// サブドメイン、未実装種目は共通施設DBへ。
export default async function SportAlias({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  switch (code) {
    case "running":
      redirect(`/running${suffix}`);
      break;
    case "golf":
      redirect("https://golf-spotomo.lykuro.ai");
      break;
    case "outdoor":
      redirect("https://outdoor-spotomo.lykuro.ai");
      break;
    default:
      redirect(`/facilities${suffix}`);
  }
}
