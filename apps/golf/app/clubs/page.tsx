import Link from "next/link";
import type { Metadata } from "next";
import { searchCourses, isGoraConfigured } from "../../lib/gora";

export const metadata: Metadata = { title: "ゴルフ場を探す" };

// ゴルフ場検索は楽天GORA API（送客モデル）。料金・空き枠は変動し、予約確定は楽天GORA側で行う。
export default async function GolfCourseSearch({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string; pref?: string }>;
}) {
  const sp = await searchParams;
  const hasQuery = Boolean(sp.keyword || sp.pref);
  const result = hasQuery
    ? await searchCourses({ keyword: sp.keyword, prefecture: sp.pref })
    : { configured: isGoraConfigured(), items: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">ゴルフ場を探す</h1>
        <Link href="/" className="btn-outline">仲間募集を探す</Link>
      </div>

      <form className="card flex flex-wrap gap-2 p-4" action="/clubs">
        <input name="keyword" defaultValue={sp.keyword ?? ""} placeholder="ゴルフ場名・キーワード" className="input max-w-xs" />
        <input name="pref" defaultValue={sp.pref ?? ""} placeholder="都道府県" className="input max-w-[10rem]" />
        <button className="btn-outline" type="submit">検索</button>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {result.items.map((c) => (
            <Link key={c.courseId} href={`/clubs/${c.courseId}`} className="card p-4 hover:shadow">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-slate-500">
                {c.prefecture ?? ""}{c.address ?? ""}
              </div>
              {c.rating != null && <div className="mt-1 text-sm text-amber-600">★ {c.rating.toFixed(1)}</div>}
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        ゴルフ場・プラン情報は楽天GORAから取得しています。料金・空き枠は変更される場合があります。
        予約確定は楽天GORAの予約ページで行ってください。
      </p>
    </div>
  );
}
