import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CourseImage } from "../course-image";
import { getCourse, searchPlans } from "../../../lib/gora";
import type { GoraCourse, GoraPlan } from "../../../lib/gora";

export const metadata: Metadata = { title: "ゴルフ場詳細・プラン" };

// 「このプランで募集する」→ /events/new にプラン情報を引き継ぐためのクエリを組み立てる。
function buildRecruitHref(course: GoraCourse, plan: GoraPlan): string {
  const p = new URLSearchParams();
  p.set("gora_course_id", course.courseId);
  p.set("gora_course_name", course.name);
  if (course.prefecture) p.set("gora_prefecture", course.prefecture);
  if (course.address) p.set("gora_address", course.address);
  if (course.detailUrl) p.set("gora_course_url", course.detailUrl);
  p.set("gora_plan_id", plan.planId);
  p.set("gora_plan_name", plan.planName);
  if (plan.price != null) p.set("gora_price", String(plan.price));
  if (plan.playDate) p.set("gora_play_date", plan.playDate);
  if (plan.startTimeZone) p.set("gora_start_time", plan.startTimeZone);
  if (plan.lunchIncluded != null) p.set("gora_lunch", plan.lunchIncluded ? "1" : "0");
  if (plan.caddieIncluded != null) p.set("gora_caddie", plan.caddieIncluded ? "1" : "0");
  if (plan.cartType) p.set("gora_cart", plan.cartType);
  if (plan.twoSumGuaranteed != null) p.set("gora_two_sum", plan.twoSumGuaranteed ? "1" : "0");
  if (plan.reserveUrl) p.set("gora_reserve_url", plan.reserveUrl);
  return `/events/new?${p.toString()}`;
}

export default async function CourseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    date?: string;
    name?: string;
    pref?: string;
    addr?: string;
    hw?: string;
    img?: string;
    rating?: string;
    url?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { date } = sp;

  // 一覧から引き継いだコース情報を優先（取り違え防止）。直リンク等で無い場合は API から取得。
  const course: GoraCourse | null = sp.name
    ? {
        courseId: id,
        name: sp.name,
        prefecture: sp.pref ?? null,
        address: sp.addr ?? null,
        latitude: null,
        longitude: null,
        rating: sp.rating != null && sp.rating !== "" ? Number(sp.rating) : null,
        imageUrl: sp.img ?? null,
        detailUrl: sp.url ?? null,
        reserveUrl: sp.url ?? null,
        highway: sp.hw ?? null,
        caption: null,
      }
    : await getCourse(id, date);
  if (!course) notFound();
  const plans = await searchPlans({ courseId: id, playDate: date });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{course.name}</h1>
        <Link href="/clubs" className="btn-outline">ゴルフ場一覧</Link>
      </div>
      {course.imageUrl && (
        <div className="relative h-48 w-full overflow-hidden rounded-lg bg-slate-100">
          <CourseImage src={course.imageUrl} alt={course.name} sizes="(max-width: 672px) 100vw, 672px" priority />
        </div>
      )}
      <p className="text-sm text-slate-500">{course.prefecture ?? ""}{course.address ?? ""}{course.highway ? `・${course.highway}` : ""}</p>
      {course.rating != null && <p className="text-sm text-amber-600">★ {course.rating.toFixed(1)}</p>}
      {course.caption && <p className="whitespace-pre-wrap text-sm text-slate-700">{course.caption}</p>}
      {course.detailUrl && (
        <a href={course.detailUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline">
          楽天GORAのゴルフ場ページを見る ↗
        </a>
      )}

      <form className="card flex flex-wrap items-end gap-2 p-4" action={`/clubs/${id}`}>
        {/* コース情報をプレー日変更後も引き継ぐ（取り違え防止）。 */}
        {sp.name && <input type="hidden" name="name" value={sp.name} />}
        {sp.pref && <input type="hidden" name="pref" value={sp.pref} />}
        {sp.addr && <input type="hidden" name="addr" value={sp.addr} />}
        {sp.hw && <input type="hidden" name="hw" value={sp.hw} />}
        {sp.img && <input type="hidden" name="img" value={sp.img} />}
        {sp.rating && <input type="hidden" name="rating" value={sp.rating} />}
        {sp.url && <input type="hidden" name="url" value={sp.url} />}
        <label className="text-sm">
          <span className="label">プレー日</span>
          <input name="date" type="date" defaultValue={date ?? ""} className="input max-w-[12rem]" />
        </label>
        <button className="btn-outline" type="submit">プランを絞り込む</button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">プラン一覧</h2>
        {plans.items.length === 0 ? (
          <p className="text-sm text-slate-400">表示できるプランがありません。プレー日を変更してお試しください。</p>
        ) : (
          <ul className="space-y-4">
            {plans.items.map((p) => (
              <li key={p.planId} className="card space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.planName}</div>
                    <div className="text-sm text-slate-500">
                      {p.playDate ?? "日付未定"}{p.startTimeZone ? `・${p.startTimeZone}` : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.lunchIncluded && <span className="badge bg-slate-100 text-slate-600">昼食付き</span>}
                      {p.caddieIncluded && <span className="badge bg-slate-100 text-slate-600">キャディ付き</span>}
                      {p.cartType && <span className="badge bg-slate-100 text-slate-600">{p.cartType}</span>}
                      {p.twoSumGuaranteed && <span className="badge bg-slate-100 text-slate-600">2サム保証</span>}
                    </div>
                  </div>
                  {p.price != null && (
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-bold">{p.price.toLocaleString()}円</div>
                      <div className="text-xs text-slate-400">/ 1名（税込）</div>
                      {p.stockCount != null && p.stockCount > 0 && (
                        <div className="text-xs text-emerald-600">残り{p.stockCount}枠</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Link href={buildRecruitHref(course, p)} className="btn-primary">このプランで募集する</Link>
                  {p.reserveUrl && (
                    <a href={p.reserveUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
                      楽天GORAで予約する ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">
        このゴルフ場・プラン情報は楽天GORAから取得しています。料金・空き枠は変更される場合があります。
        予約確定は楽天GORAの予約ページで行ってください。キャンセル規定は楽天GORAおよびゴルフ場の条件に従います。
      </p>
    </div>
  );
}
