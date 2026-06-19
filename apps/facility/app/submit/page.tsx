import { FacilitySubmitForm } from "./submit-form";

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">施設の登録・修正を申請</h1>
      <p className="text-sm text-slate-600">
        利用者からの施設登録・修正は管理者承認を経て反映されます
        （facility.facility_submissions）。重複は自動統合せず管理者が確認します。
        根拠 URL の添付を推奨します。
      </p>
      <FacilitySubmitForm />
    </div>
  );
}
