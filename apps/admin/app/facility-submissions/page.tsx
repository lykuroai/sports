import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { reviewFacilitySubmission } from "../actions";

export default async function FacilitySubmissionsPage() {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data } = await supabase
    .schema(SCHEMA.facility).from("facility_submissions")
    .select("id, submission_type, submitted_data, source_url, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false }).limit(100);

  type Row = {
    id: string; submission_type: string;
    submitted_data: Record<string, unknown>; source_url: string | null;
  };
  const subs = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">施設登録申請</h1>
      {subs.length === 0 ? (
        <p className="text-slate-500">保留中の申請はありません。</p>
      ) : subs.map((s) => (
        <div key={s.id} className="card space-y-2 p-4 text-sm">
          <div className="font-medium">{String(s.submitted_data.name ?? "(名称なし)")}</div>
          <div className="text-slate-500">
            {String(s.submitted_data.prefecture ?? "")}{String(s.submitted_data.city ?? "")}
            {String(s.submitted_data.address ?? "")}
          </div>
          {s.source_url && <a href={s.source_url} className="text-brand hover:underline" target="_blank" rel="noreferrer">出典</a>}
          <div className="flex gap-2 pt-2">
            <form action={reviewFacilitySubmission}>
              <input type="hidden" name="submission_id" value={s.id} />
              <input type="hidden" name="decision" value="approved" />
              <button className="btn-primary" type="submit">承認</button>
            </form>
            <form action={reviewFacilitySubmission}>
              <input type="hidden" name="submission_id" value={s.id} />
              <input type="hidden" name="decision" value="rejected" />
              <button className="btn-outline" type="submit">却下</button>
            </form>
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-400">承認時、submitted_data をそのまま facilities へ insert/update します（キー名一致が前提）。</p>
    </div>
  );
}
