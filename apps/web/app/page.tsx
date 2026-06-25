import Image from "next/image";
import heroImage from "../public/park-hero.webp";

// 種目ごとの表示メタ（ブランド名・ロゴ・遷移先）。
// 統合サイト化の移行期: running は統合サイト内パス（/running）へ取り込み済み。
// golf/outdoor は移行完了まで既存サブドメインへ送る（段階廃止）。Phase 4 で /golf /outdoor へ。
const SPORT_CARDS: { slug: string; label: string; logo: string; href: string }[] = [
  { slug: "running", label: "ランニング", logo: "/running-logo.svg", href: "/running" },
  { slug: "golf", label: "ゴルフとも", logo: "/golf-logo.svg", href: "//golf-spotomo.lykuro.ai" },
  { slug: "outdoor", label: "アウトドア", logo: "/outdoor-logo.svg", href: "//outdoor-spotomo.lykuro.ai" },
];

// よくある質問（総合トップ用）。回答はアプリの実態（無料/プレミアム・募集参加・
// プライバシー方針・グループチャット・相互評価・施設検索）に即して記載する。
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "スポともパークはどんなサービスですか？",
    a: "ゴルフ・ランニング・アウトドアなどを一緒に楽しむ仲間を募集・検索できるプラットフォームです。気になる募集に参加したり、自分で募集を作成して仲間を集めたりできます。",
  },
  {
    q: "利用は無料ですか？",
    a: "基本機能は無料でご利用いただけます。プレミアム会員（月額1,500円・税込）になると、参加者の条件（性別・スキル・趣味・エリア）を指定した募集や、承認制の募集を作成できます。",
  },
  {
    q: "募集に参加するにはどうすればよいですか？",
    a: "種目を選んで地域・日時から募集を探し、参加したい募集に申請します。承認制の募集は主催者の承認後、自由参加の募集はそのまま参加が確定します。",
  },
  {
    q: "電話番号やメールアドレスは他の利用者に公開されますか？",
    a: "公開されません。本名・正確な生年月日・電話番号・メールアドレスは他の利用者に表示されず、主催者であっても参加者の連絡先は見られません。連絡は募集ごとのグループチャットで行います。",
  },
  {
    q: "活動後に評価はありますか？",
    a: "開催終了後、参加者どうしで相互評価ができます。公開されるのは総合評価・参加回数・主催回数のみで、個別の低評価コメントが公開されることはありません。",
  },
  {
    q: "施設だけを探すこともできますか？",
    a: "はい。地域・駅・地図から施設を検索できます。ただし施設検索は活動場所探しを支える補助機能で、サービスの中心はあくまで仲間の募集・参加です。",
  },
];

export default function HomePage() {
  // ヒーロー（総合トップのメインビジュアル）。角は直角、種目カードを画像内に配置。
  return (
    <>
    <section className="relative overflow-hidden">
      <Image
        src={heroImage}
        alt="スポともパーク"
        priority
        className="h-auto w-full"
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 sm:p-8">
        <h1 className="text-4xl font-bold text-white drop-shadow sm:text-6xl">スポともパーク</h1>
        <p className="mt-3 max-w-3xl text-lg font-medium text-white/95 drop-shadow sm:text-2xl">
          ゴルフ・ランニング・アウトドアなど、さまざまなスポーツ・レジャーの仲間募集に参加できます。
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3">
          {SPORT_CARDS.map((c) => (
            <a
              key={c.slug}
              href={c.href}
              className="group flex items-center gap-3 rounded-lg bg-white/95 px-4 py-3 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logo} alt={c.label} className="h-full w-full object-contain" />
              </span>
              <span className="flex flex-col">
                <span className="text-base font-semibold leading-tight text-slate-900">{c.label}</span>
                <span className="text-xs text-emerald-700">仲間を探す →</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>

    <section className="mx-auto mt-12 max-w-3xl">
      <h2 className="text-2xl font-bold text-slate-900">よくある質問</h2>
      <p className="mt-1 text-sm text-slate-500">スポともパークについてのよくあるご質問にお答えします。</p>
      <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
        {FAQ.map((item) => (
          <details key={item.q} className="group bg-white open:bg-slate-50">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 font-medium text-slate-900 marker:content-none">
              <span>{item.q}</span>
              <span className="shrink-0 text-emerald-700 transition group-open:rotate-45">＋</span>
            </summary>
            <div className="px-4 pb-4 text-sm leading-relaxed text-slate-700">{item.a}</div>
          </details>
        ))}
      </div>
    </section>
    </>
  );
}
