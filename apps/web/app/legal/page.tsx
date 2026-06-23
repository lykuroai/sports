import type { Metadata } from "next";

export const metadata: Metadata = { title: "特定商取引法に基づく表記" };

// 各項目は事業者の実態に合わせて確定すること。【 】は要記入のプレースホルダ。
const ROWS: { label: string; value: React.ReactNode }[] = [
  { label: "販売事業者", value: "【運営事業者名（法人名または屋号）】" },
  { label: "運営統括責任者", value: "【代表者氏名】" },
  { label: "所在地", value: "【〒・住所】（請求があれば遅滞なく開示します）" },
  { label: "電話番号", value: "【電話番号】（請求があれば遅滞なく開示します）" },
  { label: "お問い合わせ", value: "【お問い合わせ用メールアドレス】" },
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
        ※ 本ページはひな形です。事業者情報・連絡先・価格・解約条件等を確定し、正式公開前に専門家の
        確認を受けてください。所在地・電話番号は「請求に応じて遅滞なく開示」とする運用も可能です。
      </p>
    </article>
  );
}
