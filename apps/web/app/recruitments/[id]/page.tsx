import { redirect } from "next/navigation";

// 画面遷移図の正規URL /recruitments/{id} → 既存の募集詳細（/events/{id}）。
export default async function RecruitmentDetailAlias({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/events/${id}`);
}
