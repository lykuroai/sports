import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { searchCourses, getLowestPrice, isGoraConfigured } from "../../lib/gora";

// 一覧で最安料金を取得する上限件数（API レート制限に配慮）。
const PRICE_FETCH_LIMIT = 8;

export const metadata: Metadata = { title: "ゴルフ場を探す" };

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "標準（口コミ多い順）" },
  { value: "evaluation", label: "総合評価が高い順" },
  { value: "reservation", label: "予約が多い順" },
  { value: "50on", label: "50音順" },
];

// ゴルフ場検索は楽天GORA API（送客モデル）。料金・空き枠は変動し、予約確定は楽天GORA側で行う。
export default async function GolfCourseSearch({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string; pref?: string; sort?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const hasQuery = Boolean(sp.keyword || sp.pref);
  const result = hasQuery
    ? await searchCourses({ keyword: sp.keyword, prefecture: sp.pref, sort: sp.sort })
    : { configured: isGoraConfigured(), items: [] };

  // プレー日は詳細ページのプラン検索へ引き継ぐ。
  const detailQuery = sp.date ? `?date=${encodeURIComponent(sp.date)}` : "";

  // 上位コースの最安料金（コース検索は料金を返さないためプラン検索で補完）。
  const priced = result.items.slice(0, PRICE_FETCH_LIMIT);
  const prices = await Promise.all(priced.map((c) => getLowestPrice(c.courseId, sp.date)));
  const priceMap = new Map(priced.map((c, i) => [c.courseId, prices[i]]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">ゴルフ場を探す</h1>
        <Link href="/" className="btn-outline">仲間募集を探す</Link>
      </div>

      <form className="card space-y-3 p-4" action="/clubs">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="label">キーワード・ゴルフ場名</span>
            <input name="keyword" defaultValue={sp.keyword ?? ""} placeholder="例: 〇〇カントリークラブ" className="input" />
          </label>
          <label className="text-sm">
            <span className="label">都道府県</span>
            <input name="pref" defaultValue={sp.pref ?? ""} placeholder="例: 千葉県" className="input" />
          </label>
          <label className="text-sm">
            <span className="label">プレー日</span>
            <input name="date" type="date" defaultValue={sp.date ?? ""} className="input" />
          </label>
          <label className="text-sm">
            <span className="label">並び替え</span>
            <select name="sort" defaultValue={sp.sort ?? ""} className="input">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <button className="btn-primary" type="submit">この条件で検索</button>
      </form>

      {!result.configured && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          楽天GORA API が未設定です。`RAKUTEN_APPLICATION_ID` を設定するとゴルフ場検索が有効になります。
        </p>
      )}
      {result.error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          検索中にエラーが発生しました。時間をおいて再度お試しください。
        </p>
      )}
      {result.configured && hasQuery && result.items.length === 0 && !result.error && (
        <p className="text-slate-500">条件に合うゴルフ場が見つかりません。</p>
      )}

      {result.items.length > 0 && (
        <>
          <p className="text-sm text-slate-500">{result.items.length}件のゴルフ場</p>
          <ul className="space-y-3">
            {result.items.map((c) => (
              <li key={c.courseId}>
                <Link href={`/clubs/${c.courseId}${detailQuery}`} className="card flex gap-3 overflow-hidden p-0 hover:shadow">
                  <div className="relative h-28 w-36 shrink-0 bg-slate-100">
                    {c.imageUrl ? (
                      <Image src={c.imageUrl} alt={c.name} fill sizes="144px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No Image</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-3 pr-3">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-sm text-slate-500">{c.prefecture ?? ""}{c.address ?? ""}</div>
                    {c.highway && <div className="truncate text-xs text-slate-400">{c.highway}</div>}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {c.rating != null && <span className="text-sm text-amber-600">★ {c.rating.toFixed(1)}</span>}
                        <span className="text-sm text-brand">プランを見る →</span>
                      </div>
                      {priceMap.get(c.courseId) != null && (
                        <div className="text-right leading-tight">
                          <span className="text-base font-bold">{priceMap.get(c.courseId)!.toLocaleString()}円</span>
                          <span className="text-xs text-slate-400">〜</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-slate-400">
        ゴルフ場・プラン情報は楽天GORAから取得しています。料金・空き枠は変更される場合があります。
        予約確定は楽天GORAの予約ページで行ってください。
      </p>
    </div>
  );
}
