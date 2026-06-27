import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { EVENT_STATUS_LABEL, type EventStatus } from "@spotomo/shared-types";
import { deleteRecruitment } from "../actions";

// 募集閲覧＋違反削除。管理者は core.is_admin() で running.events を全件 SELECT/UPDATE 可能（RLS）。
// 読み取りはセッションクライアント（管理者RLS）、削除はサービスロール（actions.deleteRecruitment）。
export default async function AdminRecruitmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createServerClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const showDeleted = sp.deleted === "1";

  let query = supabase
    .schema(SCHEMA.running)
    .from("events")
    .select("id, title, status, prefecture, city, event_start_at, organizer_id, capacity, created_at, deleted_at")
    .order("created_at", { ascending: false })
    .limit(100);
  query = showDeleted ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (sp.q) query = query.ilike("title", `%${sp.q}%`);

  const { data } = await query;
  type Row = {
    id: string;
    title: string;
    status: EventStatus;
    prefecture: string | null;
    city: string | null;
    event_start_at: string | null;
    organizer_id: string;
    capacity: number | null;
    created_at: string;
    deleted_at: string | null;
  };
  const events = (data ?? []) as Row[];

  // 主催者ニックネーム（account.profiles）をまとめて取得。
  const organizerIds = [...new Set(events.map((e) => e.organizer_id))];
  const { data: profs } = organizerIds.length
    ? await supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", organizerIds)
    : { data: [] as { user_id: string; nickname: string }[] };
  const nick = new Map((profs ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">募集の閲覧・違反削除</h1>
        <div className="flex gap-2 text-sm">
          <a href="/recruitments" className={`rounded-md px-3 py-1.5 ${!showDeleted ? "bg-brand text-white" : "border border-slate-300 text-slate-600"}`}>公開中</a>
          <a href="/recruitments?deleted=1" className={`rounded-md px-3 py-1.5 ${showDeleted ? "bg-brand text-white" : "border border-slate-300 text-slate-600"}`}>削除済み</a>
        </div>
      </div>

      <form action="/recruitments" className="flex gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="タイトルで検索" className="input max-w-xs" />
        {showDeleted && <input type="hidden" name="deleted" value="1" />}
        <button className="btn-outline" type="submit">検索</button>
      </form>

      {events.length === 0 ? (
        <p className="text-slate-500">{showDeleted ? "削除済みの募集はありません。" : "募集はありません。"}</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-slate-100 text-slate-600">{EVENT_STATUS_LABEL[e.status] ?? e.status}</span>
                    {e.deleted_at && <span className="badge bg-red-100 text-red-700">削除済み</span>}
                    <span className="font-semibold text-slate-900">{e.title}</span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    {[e.prefecture, e.city].filter(Boolean).join("") || "場所未定"}・開催 {fmt(e.event_start_at)}
                    ・定員 {e.capacity ?? "—"}・主催 {nick.get(e.organizer_id) ?? "（非公開）"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {site && (
                    <a href={`${site}/recruitments/${e.id}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-brand hover:text-brand">
                      閲覧 ↗
                    </a>
                  )}
                </div>
              </div>

              {!e.deleted_at && (
                <form action={deleteRecruitment} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <input type="hidden" name="event_id" value={e.id} />
                  <input name="reason" placeholder="違反理由（任意・主催者へ通知）" className="input max-w-sm" />
                  <button className="rounded-md bg-red-600 px-4 py-1.5 font-medium text-white hover:bg-red-700" type="submit">
                    違反削除
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        違反削除はソフト削除（公開一覧・詳細から除外）で、復旧可能なよう物理削除しません。操作はサービスロールで実行し core.audit_logs に記録します。
      </p>
    </div>
  );
}
