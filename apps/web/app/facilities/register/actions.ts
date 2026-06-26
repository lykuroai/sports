"use server";

import { z } from "zod";
import { createServerClient, requireGeneralAccount, SCHEMA } from "@spotomo/auth-client";
import type { SubmitState } from "../_components/types";
import { fetchSportNodes } from "../../../lib/category";

// 一般ユーザによる施設の新規登録申請。submitted_data のキーは facility.facilities の
// カラム名に一致させること（管理者承認時に reviewFacilitySubmission がそのまま insert する）。
// 例外的に sport_ids だけは facilities のカラムではなく、承認時に facility_sports へ展開される。
const schema = z.object({
  name: z.string().min(1, "施設名を入力してください").max(200),
  sport_parent: z.string().min(1, "種別（大分類）を選択してください"),
  sport_child: z.string().optional().or(z.literal("")),
  prefecture: z.string().max(20).optional(),
  city: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  source_url: z.string().url("URL の形式が正しくありません").optional().or(z.literal("")),
});

export async function registerFacility(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  // 一般会員のみ（未ログインは /login?redirect=、運営者は運営者領域へ誘導）。
  const user = await requireGeneralAccount("/facilities/register");
  const supabase = await createServerClient();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const v = parsed.data;

  // 選択された種目（小分類があればそれ、無ければ大分類）をサーバー側で再検証する。
  // 種目検索は facility_sports.sport_id で絞るため、承認時にこの種目で紐付けないと
  // 登録施設が一覧に出ない（page.tsx の facility_sports!inner 絞り込み）。
  const nodes = await fetchSportNodes(supabase);
  const chosenId = v.sport_child || v.sport_parent;
  const chosen = nodes.find((n) => n.id === chosenId);
  if (!chosen) return { error: "種別の選択が正しくありません" };

  const { error } = await supabase
    .schema(SCHEMA.facility)
    .from("facility_submissions")
    .insert({
      user_id: user.id,
      submission_type: "new",
      submitted_data: {
        name: v.name,
        facility_type: chosen.name,
        prefecture: v.prefecture || null,
        city: v.city || null,
        address: v.address || null,
        // facilities のカラムではない。承認時に facility_sports へ展開される。
        sport_ids: [chosen.id],
      },
      source_url: v.source_url || null,
    });

  if (error) return { error: error.message };
  return { error: null, ok: true };
}
