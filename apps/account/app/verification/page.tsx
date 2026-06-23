import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { VerificationForm } from "./verification-form";

const STATUS_LABEL: Record<string, string> = {
  pending: "審査中",
  verified: "承認済み",
  rejected: "却下",
  unverified: "未申請",
};

export default async function Page() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/verification");

  const [{ data: account }, { data: latest }] = await Promise.all([
    supabase
      .schema(SCHEMA.account)
      .from("users")
      .select("identity_verified_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .schema(SCHEMA.account)
      .from("verifications")
      .select("status, created_at, reviewed_at")
      .eq("user_id", user.id)
      .eq("type", "identity")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const verified = !!(account as { identity_verified_at?: string | null } | null)?.identity_verified_at;
  const status = (latest as { status?: string } | null)?.status ?? null;
  const canSubmit = !verified && status !== "pending";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">本人確認</h1>
      <p className="text-sm text-slate-600">
        本人確認書類を提出すると、管理者の審査後に「本人確認済み」になります。
        書類は審査のみに使用し、他の利用者には公開されません。
      </p>

      <div className="card flex items-center justify-between p-4 text-sm">
        <span>現在の状態</span>
        <span className="font-medium">
          {verified ? (
            <span className="badge bg-emerald-100 text-emerald-700">承認済み</span>
          ) : status ? (
            <span className="badge bg-amber-100 text-amber-700">{STATUS_LABEL[status] ?? status}</span>
          ) : (
            <span className="badge bg-slate-100 text-slate-600">未申請</span>
          )}
        </span>
      </div>

      {status === "rejected" && !verified && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          前回の申請は却下されました。書類を確認のうえ、再度申請してください。
        </p>
      )}

      {verified ? (
        <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">本人確認が完了しています。</p>
      ) : canSubmit ? (
        <VerificationForm />
      ) : (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-700">審査中です。結果をお待ちください。</p>
      )}

      <a href="/profile" className="text-brand hover:underline">← プロフィールへ戻る</a>
    </div>
  );
}
