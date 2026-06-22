# 仕様変更まとめ（2026-06-22）

本日の仕様変更・実装をテーマ別にまとめる。マイグレーションは `0023`〜`0025` を本番（リンク済み
Supabase プロジェクト）へ適用済み。型チェック・lint は全パッケージ通過。

---

## 1. ゴルフ場検索の改善（楽天GORA）

コードのみ（DB 変更なし）。実装は `apps/golf`。

| 変更 | 内容 |
|---|---|
| ページング | 検索結果を **1ページ20件**でページ送り表示。総件数・ページ数は GORA レスポンスの `count`/`pageCount` から表示（`searchCourses` が `hits=20`・`page` を送出し `pageInfo` を返す） |
| 都道府県検索の網羅 | 都道府県を `keyword` ではなく **`areaCode`（例: 千葉=12）** で絞り込み。`apps/golf/lib/areas.ts` に `PREFECTURE_AREA_CODE` を追加。コース名に県名を含まないコースの取りこぼしを解消 |
| 詳細の倶楽部取り違え修正 | `GoraGolfCourseSearch` は `golfCourseId` 非対応のため `getCourse` を **`GoraPlanSearch` 経由**に変更（`items[0]` フォールバック廃止＝ID 一致のみ採用）。加えて一覧クリック時のコース情報をクエリで詳細へ引き継ぐ |

---

## 2. プレミアム会員制（収益化 Phase B）— `0023`

利用者向けの有料サブスク。全種目共通（golf/running/outdoor、`packages/domain-common`）。

### イベントモデル
- **無料会員**：`first_come`（自由参加・承認不要）の募集のみ作成可。参加者条件は指定不可。
- **プレミアム会員**：**参加者条件**（性別・スキル・趣味=種目 `condition_sport_ids`・エリア=都道府県
  `condition_prefectures`）を指定でき、`approval`（承認制）募集を作成可。参加には主催者の承認が必要。
- 条件は申請者の**判断材料として承認画面に表示**するだけで、応募はブロックしない（§15.3 準拠。
  本名・正確な生年月日・連絡先は出さず、性別・年代・エリア・趣味のみ）。

### 強制（多重防御）
- サーバーアクションのゲートに加え、DB トリガー `core.enforce_event_premium()`＋`core.is_premium()`
  が非会員のイベントの条件を強制クリアし `first_come` に矯正。

### 課金
- Stripe サブスク（`apps/account`：Checkout / Customer Portal / Webhook）。
- 決済顧客 `account.billing_customers` は共用。Webhook が真実源（account 側は冪等キーを `user:` で名前空間化）。
- `account.membership_plans` / `account.user_subscriptions` を新設。
- **料金 ¥1,500/月**（当初 500 から変更）。

### 本番反映状況
- `0023` 適用済み。
- Stripe Price `price_1TkypfK57rO3F4HBuIUvhWnC`（¥1,500・JPY・月次・livemode）を作成し
  `membership_plans.premium_member.stripe_price_id` に設定済み。表示金額と実請求額の一致を確認。
- Webhook エンドポイント `https://account-spotomo.lykuro.ai/api/stripe/webhook` が登録・有効、
  `customer.subscription.created/updated/deleted` を購読中であることを確認。

---

## 3. 施設運営者の別アカウント体系（A案）— `0024`

**※ 仕様 §4「ロール累積（一般→主催→施設運営者→管理者）」からの意図的な逸脱。**

- 同一 Supabase Auth（`auth.users`）を共用しつつ `account.users.account_type`
  （`general` | `facility_owner`）で種別を分離。
- 施設運営者は **facility アプリ専用で登録/ログイン**（`apps/facility/app/register|login|auth/callback`、
  `signUp` の `options.data.account_type='facility_owner'`、`handle_new_user` トリガーが種別を設定）。
- 施設運営者は **一般プロフィール `account.profiles` を持たない**（トリガーが種別で出し分け）。
- ガード（`packages/auth-client`）：`requireOwnerAccount()`（運営者領域）／
  `requireGeneralAccount()`（一般領域・運営者は facility へ誘導）。`updateSession` に `loginPath` を追加し
  `facility/proxy.ts` は自前ログインへ誘導。
- **非破壊**：既存ユーザは `general` のまま（ロックアウト防止）。既存オーナーは当面 dual-use。
  FK（`facility_owners.user_id → account.users`）維持。本番は `COOKIE_DOMAIN=.lykuro.ai` で
  サブドメイン間 Cookie 共有のため、ログインは集約のまま種別で機能分離。

### 本番反映状況
- `0024` 適用済み。

---

## 4. 施設運営者の無料化（Phase A 課金 廃止）— `0025`

- 施設運営者サブスクを**廃止＝完全無料**（基本の所有・編集は元々 `facility_owners`(verified)＋RLS で無料）。
- **アプリ削除**：`apps/facility/app/plans`・facility の Stripe Webhook・`lib/billing.ts`。
  `lib/stripe.ts` は `facilityOrigin` のみ残置（オーナー登録/ログインのコールバックで使用）。
  ホームの導線文言と `proxy.ts` の保護対象（`/plans` 除外）も更新。
- **型削除**：`packages/shared-types/src/facility.ts` の Phase A 用型
  （`SubscriptionPlan`/`FacilitySubscription`/`SubscriptionStatus`/`FacilityEntitlements`）。
- **DB 削除**：`facility.subscription_plans` / `facility.facility_subscriptions` を CASCADE 削除（RLS も連動）。
- **残置（意図的）**：`account.billing_customers`・`core.stripe_events` はプレミアム会員(Phase B)と共用のため保持。
  `promotion_rank`/`promoted_until` は `0009` の schema split 時点で既に消滅済み。

### 本番反映状況
- `0025` 適用済み。`facility.subscription_plans` 消滅を REST で検証済み。

---

## 5. 未ログイン導線とログイン後リダイレクトの整備

コードのみ（DB 変更なし）。`apps/account`・`apps/golf|running|outdoor`・`packages/auth-client`。
未ログインで保護操作へ進んだら、ログイン/新規登録を経て**元のページへ戻す**フローを全体整備した。

### 仕様
1. 募集を作成 → ログイン画面 → ログイン後 → **募集作成へ戻る**。
2. 募集を作成 → 新規登録 → プロフィール画面で保存 → **募集作成へ戻る**（登録時はプロフィール設定を挟む）。
3. 上記は**参加申請・イベント編集**など他の保護操作でも同様。**全ログイン手段**（メール／Google／
   LINE／電話）で戻り先を保持する。

### 実装の要点（多重）
| テーマ | 内容 |
|---|---|
| 種目アプリに `/login` 無し | golf/running/outdoor はログイン画面を持たない（account 集約）。未ログイン誘導は `loginUrlFor(path)`（`packages/auth-client`）で **account 共通ログインの絶対URL**を生成。相対 `/login` は種目アプリで 404 になるため禁止（参加申請ボタンの 404 を解消） |
| リバプロ越しの内部アドレス | Caddy 越しでは `request.nextUrl`/`Host` が `0.0.0.0:3000` になる。戻り先は **`X-Forwarded-Host`/`X-Forwarded-Proto`**（無ければ Host）から公開URLを組み立てる（middleware・`loginUrlFor`） |
| オープンリダイレクト対策 | `resolvePostLogin()`：相対パス or 同一 apex の絶対URLのみ許可、外部URLは `/profile` フォールバック |
| 戻り先の保持手段 | メール=hidden input、**Google=`oauth_next` Cookie**（Supabase OAuth は `redirectTo` のクエリを許可リスト次第で落とすため Cookie で持ち回す）、LINE=`line_next` Cookie、電話=hidden input。新規登録は `/profile?redirect=…` を挟みプロフィール保存後に戻す |

### ビルド/デプロイの整備
- `docker/Dockerfile`：`pnpm install` を BuildKit の cache mount（`--store-dir=/pnpm/store`）化し、
  ネットワーク不調（`ERR_SOCKET_TIMEOUT`）耐性と再ビルド高速化を得る。fetch リトライ/タイムアウトも強化。
- **デプロイ時の注意**：`docker compose up -d --build` のレイヤキャッシュで古いアプリコードが
  出ることがあるため、変更アプリは `docker compose build --no-cache <app>` してから `up`。本番は
  CAPTCHA・外部OAuth のため、`curl` での非対話チェック＋実機確認で検証する。

### 本番反映状況
- 全項目を本番（同一サーバの docker compose）へデプロイ・検証済み。`/events/new` の戻り先が
  公開URLになること、未ログイン募集詳細が「ログインして参加申請する」を出すこと、login が全手段で
  `redirect` を保持すること、Google ログイン後に募集作成へ戻ることを確認。

---

## 課金体系の最終形

- **施設運営者：無料**
- **一般利用者：プレミアム会員 ¥1,500/月**（参加者条件の指定＋承認制イベント作成）

---

## ドキュメント更新

- `CLAUDE.md`：上記 2〜4 の方針（運営者の別アカウント体系・Phase A 廃止・Phase B 実装＋料金）に加え、
  **5.（ログイン後リダイレクト／`loginUrlFor`／`resolvePostLogin`／X-Forwarded-Host／OAuth Cookie）**
  を実装メモへ追記。
- `docs/monetization/phase-a-facility-owner-billing.md`：Phase A は廃止（このファイル冒頭に注記）。

---

## 残課題（未対応）

- 一般ガード `requireGeneralAccount()` を golf/running/outdoor へ横展開（現状は account の profile のみ）。
- 施設運営者の Google/LINE/電話 登録（現状その経路は `general` になる）。
- プレミアム会員の実地テスト（実購読 → `account.user_subscriptions` に `active` 反映の確認）、および
  account アプリの `STRIPE_WEBHOOK_SECRET` が当該エンドポイントの secret と一致しているかの最終確認。
- 既存施設オーナー（`general` のまま dual-use）の `facility_owner` への種別変換アクション（任意）。
- イベント編集ページ（`apps/*/app/events/[id]/edit`）の**未ログイン redirect が種目アプリの相対
  `/login`（不在）を指す**ため、未ログインで編集URLに直接来ると 404 になる（参加申請の #6 と同パターン）。
  主催者がログイン状態で編集する正規フローは正常。`loginUrlFor` 化で解消可能（未対応）。
