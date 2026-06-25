import { redirect } from "next/navigation";

// トップの横断検索（top_page_design §10）のディスパッチャ。検索対象に応じて
// 各一覧（施設 / 大会 / 仲間募集）へリダイレクトする。/api/search の代替。
export default async function SearchDispatch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; pref?: string; target?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.pref) params.set("pref", sp.pref);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";

  const target = sp.target ?? "recruitment";
  if (target === "facility") redirect(`/facilities${suffix}`);
  if (target === "event") redirect(`/events${suffix}`);

  // 仲間募集（既定）。カテゴリ別の入口へ。running は統合サイト内、golf/outdoor は
  // 移行期サブドメイン、未実装カテゴリは共通施設DBへフォールバック。
  switch (sp.category) {
    case "golf":
      redirect("https://golf-spotomo.lykuro.ai");
      break;
    case "outdoor":
      redirect("https://outdoor-spotomo.lykuro.ai");
      break;
    case "running":
      redirect(`/running${suffix}`);
      break;
    case undefined:
    case "":
      // カテゴリ未指定の仲間募集検索は横断の募集一覧へ。
      redirect(`/recruitments${suffix}`);
      break;
    default:
      // ball-sports / fitness / water-sports / winter-sports / leisure は未実装のため施設検索へ
      redirect(`/facilities${suffix}`);
  }
}
