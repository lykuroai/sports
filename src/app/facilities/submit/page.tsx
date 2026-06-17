import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FacilitySubmitForm } from "@/components/facility-submit-form";

export const metadata = { title: "施設の登録申請" };

export default async function FacilitySubmitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/facilities/submit");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/facilities" className="text-sm text-brand hover:underline">← 施設一覧</Link>
        <h1 className="mt-1 text-2xl font-bold">施設の登録申請</h1>
        <p className="mt-1 text-sm text-slate-500">
          未登録の施設を申請できます。管理者が確認し、重複確認のうえ承認すると公開されます（仕様 §6.6）。
        </p>
      </div>
      <FacilitySubmitForm mode="new" />
    </div>
  );
}
