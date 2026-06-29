import { redirect, notFound } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import type { Facility } from "@spotomo/shared-types";
import { fetchSportNodes } from "../../../../lib/category";
import { updateFacility, addFacilityImage, deleteFacilityImage } from "./actions";
import { FacilityEditForm } from "./edit-form";

export const metadata = { title: "施設情報の編集" };

// 承認済み運営者による施設情報の直接編集（即時反映）。【方針: 一般ユーザ兼施設運営者】
// 編集可否は DB の RLS facility.is_owner（status='verified'）で担保。ここでは画面ガードも行う。
export default async function FacilityEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ img_error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/facilities/${id}/edit`)}`);

  const { data: own } = await supabase
    .schema(SCHEMA.facility)
    .from("facility_owners")
    .select("status")
    .eq("facility_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if ((own as { status?: string } | null)?.status !== "verified") redirect(`/facilities/${id}`);

  const { data: facility } = await supabase
    .schema(SCHEMA.facility)
    .from("facilities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!facility) notFound();
  const f = facility as Facility;

  // 現在の種別（大分類/小分類）を facility_sports から復元してプリフィル。
  const nodes = await fetchSportNodes(supabase);
  const { data: fsRows } = await supabase
    .schema(SCHEMA.facility).from("facility_sports").select("sport_id").eq("facility_id", id);
  const selectedIds = new Set(((fsRows ?? []) as { sport_id: string }[]).map((r) => r.sport_id));
  const childNode = nodes.find((n) => n.parent_id && selectedIds.has(n.id));
  const parentNode = childNode
    ? nodes.find((n) => n.id === childNode.parent_id)
    : nodes.find((n) => !n.parent_id && selectedIds.has(n.id));

  // 施設画像（URL方式）。
  const { data: imgRows } = await supabase
    .schema(SCHEMA.facility).from("facility_images")
    .select("id, url, display_order").eq("facility_id", id)
    .order("display_order", { ascending: true });
  const images = (imgRows ?? []) as { id: string; url: string; display_order: number }[];

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">施設情報の編集</h1>
      <p className="text-sm text-slate-600">承認済み運営者として施設情報を直接更新します（保存すると即時反映されます）。</p>
      <FacilityEditForm
        action={updateFacility}
        facility={f}
        sportNodes={nodes}
        defaultParentId={parentNode?.id ?? null}
        defaultChildId={childNode?.id ?? null}
      />

      {/* 施設画像（URL方式・アップロードなし） */}
      <section className="card space-y-3 p-6">
        <h2 className="font-semibold">施設画像</h2>
        <p className="text-xs text-slate-500">画像URL、または出典ページURL（og:image 等を自動抽出）を登録します（一覧の先頭がサムネイル）。アップロードには対応していません。</p>
        {sp.img_error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">画像を取得できませんでした。画像URL、または画像を含むページURLを入力してください。</p>}
        {images.length === 0 ? (
          <p className="text-sm text-slate-400">登録された画像はありません。</p>
        ) : (
          <ul className="space-y-2">
            {images.map((im) => (
              <li key={im.id} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{im.url}</span>
                <form action={deleteFacilityImage}>
                  <input type="hidden" name="facility_id" value={f.id} />
                  <input type="hidden" name="image_id" value={im.id} />
                  <button className="btn-outline text-red-600" type="submit">削除</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addFacilityImage} className="flex items-center gap-2">
          <input type="hidden" name="facility_id" value={f.id} />
          <input name="url" type="url" className="input flex-1" placeholder="https://example.com/photo.jpg または 出典ページURL" required />
          <button className="btn-primary" type="submit">追加</button>
        </form>
      </section>
    </div>
  );
}
