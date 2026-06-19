export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">施設の登録・修正を申請</h1>
      <p className="text-sm text-slate-600">
        利用者からの施設登録・修正は管理者承認を経て反映されます（facility.facility_submissions、
        submitted_data のキーは facilities のカラム名に一致させること）。根拠 URL の添付を推奨します。
      </p>
      <p className="text-xs text-slate-400">フォーム実装は移植予定（旧 facilities/submit）。</p>
    </div>
  );
}
