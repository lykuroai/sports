import type { Metadata } from "next";

export const metadata: Metadata = { title: "特定商取引法に基づく表記" };

// 事業者情報は運用会社（株式会社eビジネスソリューション）の実態に基づく。価格・解約条件は
// 提供サービスの実態に合わせて確定すること。
const ROWS: { label: string; value: React.ReactNode }[] = [
  { label: "販売事業者", value: "株式会社eビジネスソリューション（EBS）" },
  { label: "運営統括責任者", value: "代表取締役社長 郭 亮" },
  { label: "所在地", value: "〒135-0043 東京都江東区塩浜2-13-9" },
  { label: "電話番号", value: "03-6666-3425" },
  { label: "お問い合わせ", value: "support@lykuro.ai" },
  {
    label: "販売価格",
    value: (
      <>
        プレミアム会員：月額 1,500 円（税込）<br />
        その他の有料サービスは各サービスの申込画面に表示します。
      </>
    ),
  },
  { label: "商品代金以外の必要料金", value: "インターネット接続料金・通信料金等は利用者の負担となります。" },
  { label: "支払方法", value: "クレジットカード決済（決済代行：Stripe）" },
  { label: "支払時期", value: "初回はお申込み時に課金され、以降は各更新日に自動で課金されます。" },
  {
    label: "サービスの提供時期",
    value: "決済完了後、直ちに利用可能となります。",
  },
  {
    label: "解約・自動更新",
    value: (
      <>
        プレミアム会員は所定の期間ごとに自動更新されます。マイページ（決済情報）からいつでも解約でき、
        解約後は次回更新日以降の課金は行われません。
      </>
    ),
  },
  {
    label: "返品・キャンセル",
    value: (
      <>
        サービスの性質上、提供開始後の返金・日割り返金は行いません。法令で認められる場合を除きます。
      </>
    ),
  },
  {
    label: "動作環境",
    value: "最新版の主要なウェブブラウザでのご利用を推奨します。",
  },
];

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">特定商取引法に基づく表記</h1>
        <p className="text-sm text-slate-500">スポともパーク</p>
      </header>

      <dl className="overflow-hidden rounded-lg border border-slate-200 text-sm">
        {ROWS.map((r, i) => (
          <div
            key={r.label}
            className={`grid grid-cols-1 sm:grid-cols-[12rem_1fr] ${i > 0 ? "border-t border-slate-200" : ""}`}
          >
            <dt className="bg-slate-50 px-4 py-3 font-medium text-slate-600">{r.label}</dt>
            <dd className="px-4 py-3 text-slate-700">{r.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-slate-400">
        ※ 価格・解約条件等を確定し、正式公開前に専門家の確認を受けてください。
      </p>
    </article>
  );
}
