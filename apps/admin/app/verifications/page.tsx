import { requireAdmin, createServerClient, createAdminClient, SCHEMA } from "@spotomo/auth-client";
import { reviewVerification } from "../actions";

export default async function VerificationsPage() {
  await requireAdmin();
  const supabase = await createServerClient();

  // 管理者向け RLS（verifications_self: user_id=auth.uid() or is_admin()）で pending を読む。
  const { data } = await supabase
    .schema(SCHEMA.account)
    .from("verifications")
    .select("id, user_id, type, evidence_url, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = { id: string; user_id: string; type: string; evidence_url: string | null; created_at: string };
  const rows = (data ?? []) as Row[];

  // 申請者のニックネーム（表示用）。
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = ids.length
    ? await supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", ids)
    : { data: [] as { user_id: string; nickname: string }[] };
  const nameMap = new Map((profiles ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));

  // 非公開バケットの証跡は本人しか読めないため、サービスロールで署名URLを発行して閲覧する。
  const admin = createAdminClient();
  const signed = new Map<string, string>();
  await Promise.all(
    rows.map(async (r) => {
      if (!r.evidence_url) return;
      const { data: s } = await admin.storage.from("verification-docs").createSignedUrl(r.evidence_url, 600);
      if (s?.signedUrl) signed.set(r.id, s.signedUrl);
    }),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">本人確認 審査</h1>
      {rows.length === 0 ? (
        <p className="text-slate-500">審査待ちの申請はありません。</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="card space-y-2 p-4 text-sm">
            <div className="font-medium">{nameMap.get(r.user_id) ?? "(ニックネーム未設定)"}</div>
            <div className="text-slate-500">種別: {r.type}／申請日時: {new Date(r.created_at).toLocaleString("ja-JP")}</div>
            {signed.get(r.id) ? (
              <a href={signed.get(r.id)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                提出書類を開く（10分間有効）
              </a>
            ) : (
              <span className="text-slate-400">書類を取得できませんでした</span>
            )}
            <div className="flex gap-2 pt-2">
              <form action={reviewVerification}>
                <input type="hidden" name="verification_id" value={r.id} />
                <input type="hidden" name="user_id" value={r.user_id} />
                <input type="hidden" name="decision" value="approved" />
                <button className="btn-primary" type="submit">承認</button>
              </form>
              <form action={reviewVerification}>
                <input type="hidden" name="verification_id" value={r.id} />
                <input type="hidden" name="user_id" value={r.user_id} />
                <input type="hidden" name="decision" value="rejected" />
                <button className="btn-outline text-red-600" type="submit">却下</button>
              </form>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
