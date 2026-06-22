import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { reviewFacilityOwner } from "../actions";

export default async function FacilityOwnersPage() {
  await requireAdmin();
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .select("facility_id, user_id, evidence_url, note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = {
    facility_id: string;
    user_id: string;
    evidence_url: string | null;
    note: string | null;
  };
  const apps = (data ?? []) as Row[];

  // 施設名・申請者ニックネームを引く（管理者 RLS で読める）。
  const facilityIds = [...new Set(apps.map((a) => a.facility_id))];
  const userIds = [...new Set(apps.map((a) => a.user_id))];
  const [{ data: facs }, { data: profs }] = await Promise.all([
    facilityIds.length
      ? supabase.schema(SCHEMA.facility).from("facilities").select("id, name, prefecture, city").in("id", facilityIds)
      : Promise.resolve({ data: [] as { id: string; name: string; prefecture: string | null; city: string | null }[] }),
    userIds.length
      ? supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; nickname: string }[] }),
  ]);
  const facMap = new Map((facs ?? []).map((f: { id: string; name: string; prefecture: string | null; city: string | null }) => [f.id, f]));
  const nameMap = new Map((profs ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">施設運営者申請</h1>
      <p className="text-sm text-slate-500">
        承認すると当該施設の verified 運営者になり、施設情報を編集できます（facility_owner ロールも付与）。
      </p>

      {apps.length === 0 ? (
        <p className="text-slate-500">保留中の申請はありません。</p>
      ) : (
        apps.map((a) => {
          const fac = facMap.get(a.facility_id);
          return (
            <div key={`${a.facility_id}:${a.user_id}`} className="card space-y-2 p-4 text-sm">
              <div className="font-medium">{fac?.name ?? a.facility_id}</div>
              <div className="text-slate-500">
                {fac ? `${fac.prefecture ?? ""}${fac.city ?? ""}` : ""}｜申請者: {nameMap.get(a.user_id) ?? a.user_id}
              </div>
              {a.note && <p className="text-slate-600">{a.note}</p>}
              {a.evidence_url && (
                <a href={a.evidence_url} className="text-brand hover:underline" target="_blank" rel="noreferrer">根拠URL</a>
              )}
              <div className="flex gap-2 pt-2">
                <form action={reviewFacilityOwner}>
                  <input type="hidden" name="facility_id" value={a.facility_id} />
                  <input type="hidden" name="user_id" value={a.user_id} />
                  <input type="hidden" name="decision" value="verified" />
                  <button className="btn-primary" type="submit">承認</button>
                </form>
                <form action={reviewFacilityOwner}>
                  <input type="hidden" name="facility_id" value={a.facility_id} />
                  <input type="hidden" name="user_id" value={a.user_id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="btn-outline" type="submit">却下</button>
                </form>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
