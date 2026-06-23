import Image from "next/image";
import { SPORT_DOMAINS } from "@spotomo/shared-types";
import heroImage from "../public/park-hero.webp";

// 種目ごとの表示メタ（ブランド名・ロゴ）。host は SPORT_DOMAINS と対応。
const SPORT_META: Record<string, { label: string; logo: string }> = {
  golf: { label: "ゴルフとも", logo: "/golf-logo.svg" },
  running: { label: "ランニング", logo: "/running-logo.svg" },
  outdoor: { label: "アウトドア", logo: "/outdoor-logo.svg" },
};

export default function HomePage() {
  // ヒーロー（総合トップのメインビジュアル）。角は直角、種目カードを画像内に配置。
  return (
    <section className="relative overflow-hidden">
      <Image
        src={heroImage}
        alt="スポともパーク"
        priority
        className="h-auto w-full"
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 sm:p-8">
        <h1 className="text-4xl font-bold text-white drop-shadow sm:text-6xl">スポともパーク</h1>
        <p className="mt-3 max-w-2xl text-base font-medium text-white/95 drop-shadow sm:text-xl">
          ゴルフ・ランニング・アウトドアなど、さまざまなスポーツ・レジャーの仲間募集に参加できます。
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3">
          {SPORT_DOMAINS.map((d) => {
            const meta = SPORT_META[d.slug] ?? { label: d.name, logo: "" };
            return (
              <a
                key={d.slug}
                href={`//${d.host}`}
                className="group flex items-center gap-3 rounded-lg bg-white/95 px-4 py-3 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={meta.logo} alt={meta.label} className="h-full w-full object-contain" />
                </span>
                <span className="flex flex-col">
                  <span className="text-base font-semibold leading-tight text-slate-900">{meta.label}</span>
                  <span className="text-xs text-emerald-700">仲間を探す →</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
