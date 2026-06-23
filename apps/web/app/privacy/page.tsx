import type { Metadata } from "next";

export const metadata: Metadata = { title: "プライバシーポリシー" };

const UPDATED = "2026年6月23日";

export default function PrivacyPage() {
  return (
    <article className="prose-legal mx-auto max-w-3xl space-y-6 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
        <p className="text-sm text-slate-500">最終更新日：{UPDATED}</p>
      </header>

      <p className="text-sm text-slate-700">
        スポともパーク（以下「当サービス」といいます。）は、利用者の個人情報の保護を重要な責務と
        考え、個人情報の保護に関する法律その他の関係法令を遵守し、以下のとおりプライバシーポリシー
        （以下「本ポリシー」といいます。）を定めます。
      </p>

      <Section title="1. 取得する情報">
        <p>当サービスは、サービスの提供にあたり、次の情報を取得します。</p>
        <ul className="list-disc pl-6">
          <li>氏名、メールアドレス、電話番号などの登録情報</li>
          <li>ニックネーム、性別、年代、活動エリア、取り組む種目などのプロフィール情報</li>
          <li>本人確認のために提出された書類の画像</li>
          <li>募集・参加・チャット・評価・通報などのサービス利用に関する情報</li>
          <li>決済に関する情報（カード情報は決済代行会社が取り扱い、当サービスは保持しません）</li>
          <li>位置情報（現在地周辺検索を利用する場合）</li>
          <li>Cookie、端末・ブラウザ情報、アクセスログ、IPアドレス等の技術情報</li>
        </ul>
      </Section>

      <Section title="2. 利用目的">
        <ul className="list-disc pl-6">
          <li>本人確認、認証、アカウント管理のため</li>
          <li>仲間募集・参加申請・グループチャット等の機能提供のため</li>
          <li>施設情報の検索・表示のため</li>
          <li>利用料金の決済、請求のため</li>
          <li>通知（アプリ内・メール）の送信のため</li>
          <li>不正利用の防止、安全確保、通報対応、利用規約違反への対応のため</li>
          <li>サービスの改善、新機能の開発、統計分析のため</li>
          <li>お問い合わせへの対応のため</li>
        </ul>
      </Section>

      <Section title="3. 第三者提供">
        <p>
          当サービスは、次の場合を除き、あらかじめ利用者の同意を得ることなく個人情報を第三者に
          提供しません。
        </p>
        <ul className="list-disc pl-6">
          <li>法令に基づく場合</li>
          <li>人の生命、身体または財産の保護のために必要がある場合</li>
          <li>業務委託先に対して利用目的の達成に必要な範囲で提供する場合（下記4）</li>
        </ul>
      </Section>

      <Section title="4. 業務委託・外部サービスの利用">
        <p>
          当サービスは、利用目的の達成に必要な範囲で、以下の外部サービスを利用し、個人情報の取扱いを
          委託することがあります。各社における情報の取扱いは各社のプライバシーポリシーに従います。
        </p>
        <ul className="list-disc pl-6">
          <li>Supabase（認証・データベース・ストレージ）</li>
          <li>Amazon Web Services（メール送信／Amazon SES 等）</li>
          <li>Twilio（SMS・電話番号認証）</li>
          <li>Stripe（決済処理）</li>
          <li>Cloudflare（不正防止・CAPTCHA）</li>
          <li>楽天ウェブサービス（ゴルフ場予約情報の取得：楽天GORA）</li>
        </ul>
      </Section>

      <Section title="5. 利用者間で公開される情報">
        <p>
          ニックネーム、プロフィール画像、性別・年代・活動エリア、総合評価・参加回数・主催回数等は、
          他の利用者に公開される場合があります。
          <strong>氏名、正確な生年月日、電話番号、メールアドレスは、主催者を含む他の利用者に公開しません。</strong>
        </p>
      </Section>

      <Section title="6. 安全管理措置">
        <p>
          当サービスは、個人情報の漏えい、滅失または毀損の防止その他の安全管理のために、アクセス制御
          （行レベルセキュリティ等）、通信の暗号化、本人確認書類の非公開保管などの必要かつ適切な措置を
          講じます。
        </p>
      </Section>

      <Section title="7. 開示・訂正・利用停止等の請求">
        <p>
          利用者は、自己の個人情報について、開示、訂正、追加、削除、利用停止、消去または第三者提供の
          停止を請求することができます。請求は下記のお問い合わせ窓口までご連絡ください。マイページから
          一部の情報の編集・退会を行うこともできます。
        </p>
      </Section>

      <Section title="8. Cookie 等の利用">
        <p>
          当サービスは、ログイン状態の維持やサービスの利便性向上、利用状況の分析のために Cookie 等を
          利用します。ブラウザの設定により Cookie を無効にできますが、一部の機能が利用できなくなる
          場合があります。
        </p>
      </Section>

      <Section title="9. 本ポリシーの変更">
        <p>
          当サービスは、必要に応じて本ポリシーを変更することがあります。重要な変更を行う場合は、
          サービス上での掲示その他適切な方法により周知します。
        </p>
      </Section>

      <Section title="10. お問い合わせ窓口">
        <p>本ポリシーに関するお問い合わせは、以下までご連絡ください。</p>
        <p>
          【運営事業者名】<br />
          メールアドレス：【お問い合わせ用メールアドレス】
        </p>
      </Section>

      <p className="text-xs text-slate-400">
        ※ 本ページはひな形です。事業者情報・連絡先等を確定し、正式公開前に専門家の確認を受けてください。
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}
