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

  // 仲間募集（既定）。統合サイト化により全種目を web 内の横断募集一覧へ集約。
  // running は専用トップ、その他カテゴリは category で絞った募集一覧へ向ける。
  switch (sp.category) {
    case "running":
      redirect(`/running${suffix}`);
      break;
    case undefined:
    case "":
      // カテゴリ未指定の仲間募集検索は横断の募集一覧へ。
      redirect(`/recruitments${suffix}`);
      break;
    default: {
      // golf / outdoor / ball-sports / fitness 等はカテゴリで絞った募集一覧へ。
      const catParams = new URLSearchParams(qs);
      catParams.set("category", sp.category);
      redirect(`/recruitments?${catParams.toString()}`);
    }
  }
}
