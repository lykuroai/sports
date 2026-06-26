import Link from "next/link";
import { createServerClient, requireGeneralAccount } from "@spotomo/auth-client";
import { FacilitySubmitForm } from "../_components/facility-submit-form";
import { fetchSportNodes } from "../../../lib/category";
import { registerFacility } from "./actions";

export default async function RegisterFacilityPage() {
  // 未ログインは /login?redirect=/facilities/register へ。運営者は運営者領域へ。
  await requireGeneralAccount("/facilities/register");
  const supabase = await createServerClient();
  const sportNodes = await fetchSportNodes(supabase);

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">施設を登録する</h1>
        <Link href="/facilities" className="text-sm text-brand hover:underline">← 施設をさがす</Link>
      </div>
      <p className="text-sm text-slate-600">
        募集を開催したい施設が見つからないときは、ここから登録を申請できます。
        申請内容は管理者の承認を経て施設として公開されます。重複は自動統合せず管理者が確認するため、
        できるだけ正確な施設名・住所と、根拠となる出典 URL を添えてください。
      </p>
      <FacilitySubmitForm
        action={registerFacility}
        sportNodes={sportNodes}
        doneMessage="施設登録の申請を受け付けました。管理者の承認後に施設として公開され、その施設で募集を作成できるようになります。"
      />
    </div>
  );
}
