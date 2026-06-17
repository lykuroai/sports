import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { stopRecruitment } from "../actions";
import { RECRUITMENT_STATUS_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export default async function AdminRecruitmentsPage() {
  const supabase = await createClient();

  // 管理者は RLS により下書き/非公開含む全募集を閲覧できる
  const { data: recruitments } = await supabase
    .from("recruitments")
    .select("id, title, status, event_start_at, created_at, profiles:organizer_id ( display_name )")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">募集管理</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="p-3">タイトル</th>
              <th className="p-3">主催者</th>
              <th className="p-3">開催日</th>
              <th className="p-3">状態</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {(recruitments ?? []).map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="p-3 font-medium">
                  <Link href={`/recruitments/${r.id}`} className="hover:text-brand hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td className="p-3 text-slate-500">
                  {/* @ts-expect-error supabase join 形状 */}
                  {r.profiles?.display_name ?? "—"}
                </td>
                <td className="p-3 text-slate-400">{formatDateTime(r.event_start_at)}</td>
                <td className="p-3">
                  <span className="badge bg-slate-100 text-slate-600">
                    {RECRUITMENT_STATUS_LABEL[r.status as keyof typeof RECRUITMENT_STATUS_LABEL]}
                  </span>
                </td>
                <td className="p-3">
                  {r.status !== "cancelled" && (
                    <form action={stopRecruitment}>
                      <input type="hidden" name="recruitment_id" value={r.id} />
                      <button className="btn-outline px-3 py-1 text-xs text-red-600">募集を中止</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
