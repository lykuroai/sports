import { createClient } from "@/lib/supabase/server";
import { reviewFacilitySubmission } from "../../actions";
import { formatDateTime } from "@/lib/format";

export default async function AdminFacilitySubmissionsPage() {
  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("facility_submissions")
    .select("id, submission_type, submitted_data, evidence_url, comment, status, created_at, facility_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">施設登録申請</h1>
      <p className="text-sm text-slate-500">
        利用者から申請された施設の新規登録・修正を確認し、承認すると公開されます（仕様 §6.6）。
        重複施設は承認前に確認してください。
      </p>

      {(submissions ?? []).length === 0 ? (
        <p className="card p-8 text-center text-slate-500">承認待ちの申請はありません。</p>
      ) : (
        <ul className="space-y-4">
          {submissions!.map((s) => {
            const data = (s.submitted_data ?? {}) as Record<string, unknown>;
            return (
              <li key={s.id} className="card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="badge bg-brand/10 text-brand">
                    {s.submission_type === "new" ? "新規登録" : "修正申請"}
                  </span>
                  <span className="font-semibold">{String(data.name ?? "（名称未記載）")}</span>
                  <span className="ml-auto text-xs text-slate-400">{formatDateTime(s.created_at)}</span>
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {Object.entries(data).map(([k, v]) =>
                    k === "name" ? null : (
                      <div key={k} className="flex gap-2">
                        <dt className="shrink-0 text-slate-400">{k}</dt>
                        <dd className="break-all">{String(v)}</dd>
                      </div>
                    ),
                  )}
                </dl>

                {s.evidence_url && (
                  <p className="mt-2 text-sm">
                    根拠URL:{" "}
                    <a href={s.evidence_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                      {s.evidence_url}
                    </a>
                  </p>
                )}
                {s.comment && <p className="mt-1 text-sm text-slate-600">補足: {s.comment}</p>}

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={reviewFacilitySubmission}>
                    <input type="hidden" name="submission_id" value={s.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="btn-primary">承認して公開</button>
                  </form>
                  <form action={reviewFacilitySubmission} className="flex items-end gap-2">
                    <input type="hidden" name="submission_id" value={s.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input name="rejection_reason" className="input" placeholder="却下理由（任意）" />
                    <button className="btn-outline text-red-600">却下</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
