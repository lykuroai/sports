import { requireAdmin } from "@spotomo/auth-client";
import { ImportForm } from "./import-form";

export default async function FacilityImportPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">施設CSV取り込み</h1>
      <p className="text-sm text-slate-500">
        CSV を facility.facilities へ一括登録します（サービスロール、audit_logs 記録）。
        重複は自動統合せず、登録後に管理者が確認します。
      </p>
      <ImportForm />
    </div>
  );
}
