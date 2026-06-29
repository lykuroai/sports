import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, createServerClient, SCHEMA } from "@spotomo/auth-client";
import { OWNER_STATUS_LABEL } from "@spotomo/shared-types";
import type { Facility } from "@spotomo/shared-types";
import type { SportNode } from "@spotomo/shared-ui";
import { updateFacilityAdmin, deleteFacility, reviewFacilityOwner, revokeFacilityOwner } from "../../../actions";
import { FacilityFields } from "../facility-fields";

export const metadata = { title: "施設の編集" };

export default async function FacilityEditAdminPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: facility } = await supabase
    .schema(SCHEMA.facility).from("facilities").select("*").eq("id", id).maybeSingle();
  if (!facility) notFound();
  const f = facility as Facility;

  // 種別（大分類/小分類）の現在値を facility_sports から復元してプリフィル。
  const { data: nodeRows } = await supabase
    .schema(SCHEMA.core).from("sports").select("id, name, parent_id").eq("status", "published").order("display_order", { ascending: true });
  const nodes = (nodeRows ?? []) as SportNode[];
  const { data: fsRows } = await supabase
    .schema(SCHEMA.facility).from("facility_sports").select("sport_id").eq("facility_id", id);
  const selectedIds = new Set(((fsRows ?? []) as { sport_id: string }[]).map((r) => r.sport_id));
  const childNode = nodes.find((n) => n.parent_id && selectedIds.has(n.id));
  const parentNode = childNode ? nodes.find((n) => n.id === childNode.parent_id) : nodes.find((n) => !n.parent_id && selectedIds.has(n.id));

  // この施設の運営者（全 status）。申請者ニックネームも引く。
  const { data: ownerRows } = await supabase
    .schema(SCHEMA.facility).from("facility_owners")
    .select("user_id, status, evidence_url, note, created_at")
    .eq("facility_id", id)
    .order("created_at", { ascending: false });
  type Owner = { user_id: string; status: string; evidence_url: string | null; note: string | null; created_at: string };
  const owners = (ownerRows ?? []) as Owner[];
  const userIds = [...new Set(owners.map((o) => o.user_id))];
  const { data: profs } = userIds.length
    ? await supabase.schema(SCHEMA.account).from("profiles").select("user_id, nickname").in("user_id", userIds)
    : { data: [] as { user_id: string; nickname: string }[] };
  const nameMap = new Map((profs ?? []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname]));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">施設の編集</h1>
        <Link href="/facilities/manage" className="text-sm text-brand hover:underline">← 一覧へ</Link>
      </div>

      <form action={updateFacilityAdmin} className="card space-y-4 p-6">
        <input type="hidden" name="facility_id" value={f.id} />
        <FacilityFields v={f} sportNodes={nodes} defaultParentId={parentNode?.id ?? null} defaultChildId={childNode?.id ?? null} />
        <button className="btn-primary w-full" type="submit">保存する</button>
      </form>

      {/* 運営者の管理 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">運営者の管理</h2>
        {owners.length === 0 ? (
          <p className="text-sm text-slate-500">この施設の運営者申請はありません。</p>
        ) : (
          <ul className="space-y-2">
            {owners.map((o) => (
              <li key={o.user_id} className="card space-y-2 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{nameMap.get(o.user_id) ?? o.user_id}</span>
                  <span className={o.status === "verified" ? "text-emerald-700" : "text-slate-500"}>
                    {OWNER_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                {o.note && <p className="text-slate-600">{o.note}</p>}
                {o.evidence_url && <a href={o.evidence_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">根拠URL</a>}
                <div className="flex gap-2 pt-1">
                  {o.status === "pending" && (
                    <>
                      <form action={reviewFacilityOwner}>
                        <input type="hidden" name="facility_id" value={f.id} />
                        <input type="hidden" name="user_id" value={o.user_id} />
                        <input type="hidden" name="decision" value="verified" />
                        <button className="btn-primary" type="submit">承認</button>
                      </form>
                      <form action={reviewFacilityOwner}>
                        <input type="hidden" name="facility_id" value={f.id} />
                        <input type="hidden" name="user_id" value={o.user_id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button className="btn-outline" type="submit">却下</button>
                      </form>
                    </>
                  )}
                  {o.status === "verified" && (
                    <form action={revokeFacilityOwner}>
                      <input type="hidden" name="facility_id" value={f.id} />
                      <input type="hidden" name="user_id" value={o.user_id} />
                      <button className="btn-outline text-red-600" type="submit">権限を取り消す</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 削除 */}
      <section className="space-y-2 border-t border-slate-200 pt-4">
        <h2 className="text-lg font-semibold text-red-600">施設の削除</h2>
        <p className="text-sm text-slate-500">削除すると種目・設備・画像・出所・レビュー・運営者も連動して削除されます（取り消せません）。</p>
        <form action={deleteFacility}>
          <input type="hidden" name="facility_id" value={f.id} />
          <button className="btn-outline text-red-600" type="submit">この施設を削除する</button>
        </form>
      </section>
    </div>
  );
}
