# スポともパーク（MVP）

スポーツ・レジャーを一緒に楽しむ仲間を募集・検索できるWebプラットフォーム。
募集（仲間集め）と参加を中心に据え、施設検索はその開催場所探しを補助する。

**共通ユーザ基盤 + 種目別ドメイン分離**のモノレポ構成（pnpm + Turborepo）。
ひとつのアカウントで複数種目（ゴルフ／ランニング／アウトドア…）を利用できる。
設計の全体像は [`docs/architecture/`](./docs/architecture/README.md) を参照。

## モノレポ構成

```text
apps/
  web/        トップ・種目ハブ (:3000)        account/  共通ユーザ管理 (:3001)
  golf/       ゴルフ＝種目テンプレ (:3002)     running/  ランニング (:3003)
  outdoor/    アウトドア (:3004)              facility/ 施設運営者 (:3005)
  admin/      運営管理 (:3006)
packages/
  shared-types  共通型・enum・状態遷移カタログ   auth-client  Supabase/認証クライアント
  domain-common 通知(notifyUser)・メール          shared-ui    共通UI（ヘッダ等）
  api-client    ドメインAPIクライアント          config       tsconfig/eslint/tailwind 共有
```

DB は単一 Supabase をスキーマ分離（`account` / `core` / `facility` / `golf` / `running` / `outdoor`）。
全種目が共通 `account.users.id` を参照する。詳細は
[`docs/architecture/database_design.md`](./docs/architecture/database_design.md)。

## 技術スタック

- **pnpm workspaces + Turborepo**（モノレポ）
- **Next.js 16**（App Router / Server Actions）+ TypeScript + React 19（apps ごとに独立）
- **Supabase**（Auth / PostgreSQL / PostGIS / Storage / Realtime、スキーマ分離）
- **Tailwind CSS v3**

## セットアップ

### 1. 依存関係

```bash
pnpm install          # ルートで実行（全 workspace を解決）
pnpm dev              # 全 app を並行起動（turbo）。個別は pnpm --filter @spotomo/app-golf dev
pnpm build            # 全 app をビルド（型チェック込み）
```

### 2. 環境変数

`.env.example` を `.env.local` にコピーし、Supabase プロジェクトの値を設定する。

```bash
cp .env.example .env.local
```

| 変数 | 取得元 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上（anon public key） |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上（サーバー専用。CSV取り込み等の管理処理用） |

### 3. データベース

Supabase CLI（`brew install supabase/tap/supabase`）を導入し、SQL を適用する。

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # supabase/migrations/*.sql を適用
psql "$DATABASE_URL" -f supabase/seed.sql   # スポーツカテゴリーを投入
```

> CLI を使わない場合は、SQL Editor で `0001`〜`0008`（旧 public スキーマの初期構築）→
> **`0009_schema_split.sql`（旧 public を破棄し account/core/facility を再構築）→
> `0010_schema_split_rls.sql` → `0011_golf.sql` → `0012_running_outdoor.sql`** →
> `seed.sql`（core.sports へ投入）の順に実行する。
>
> ★ 適用後、**Supabase > Project Settings > API > Exposed schemas** に
> `account, core, facility, golf, running, outdoor` を追加すること（supabase-js が
> `.schema()` でこれらを参照するため。usage 自体は migration で grant 済み）。

#### 管理者の付与

管理画面（`/admin`）を使うには、対象ユーザーに admin ロールを付与する。

```sql
insert into account.user_roles (user_id, role)
values ('<auth.users の UUID>', 'admin');
```

管理操作は `SUPABASE_SERVICE_ROLE_KEY` 経由で RLS をバイパスして実行するため、
この環境変数の設定が必要。

PostGIS 拡張は `0001_init.sql` 内で有効化している。

### 4. 認証プロバイダ（任意）

Google ログインを使う場合は、Supabase の Authentication > Providers で Google を有効化し、
リダイレクト URL に `http://localhost:3001/auth/callback`（account app）を登録する。

### 5. 開発サーバー

```bash
pnpm dev                              # 全 app を並行起動（turbo）
pnpm --filter @spotomo/app-golf dev   # 個別（golf は :3002）
```

各 app のポート: web :3000 / account :3001 / golf :3002 / running :3003 /
outdoor :3004 / facility :3005 / admin :3006。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 全 app の開発サーバー（turbo） |
| `pnpm build` | 全 app の本番ビルド（型チェック込み） |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | 型チェック |
| `pnpm db:types` | Supabase から型生成（`supabase link` 後、`packages/shared-types/src/database.generated.ts` へ） |

## Docker 起動

7 app + Caddy（リバースプロキシ）を `docker-compose.yml` で起動する。**本番・開発とも
同一構成**で、Caddy が `docker/certs` のワイルドカード実証明書（`*.lykuro.ai`、公的CA発行）
で HTTPS 配信する（ACME 自動取得はしない）。Makefile にショートカットあり。

事前準備:
- `cp .env.production.example .env.production` … シークレット等を設定（`NEXT_PUBLIC_*` は
  `docker-compose.yml` 側にも焼き込み値あり）。
- `docker/certs/` に `fullchain.pem` と復号済み `privkey.nopass.pem` を配置（gitignore 済み）。
- DNS: 各サブドメイン（`spotomo` / `account-spotomo` / `golf-spotomo` / `running-spotomo` /
  `outdoor-spotomo` / `facility-spotomo` / `admin-spotomo` `.lykuro.ai`）を、本番はサーバへ、
  開発機は `/etc/hosts` で `127.0.0.1` へ向ける。

```bash
make docker-up              # = docker compose up -d --build（本番・開発共通）
make docker-down            # 停止（docker compose down）
make docker-logs            # 全ログ追従
make docker-logs s=golf     # 個別サービスのログ
```

開発機で UI を素早く回す場合は Docker ではなく `pnpm dev`（localhost:3000–3006）を使う。

## 実装済み機能

**共通基盤（account）**: メール／Google ログイン・会員登録・ログアウト、共通プロフィール、
通知一覧（既読化）、ブロック一覧（解除）、通知設定/決済/本人確認/退会の枠。

**各種目（golf / running / outdoor、共通コアを再利用）**: 募集の一覧・検索・詳細・作成、
参加申請（先着/承認）＋通知、主催者の承認/拒否、本人キャンセル、グループチャット
（送信＋Realtime購読）、相互評価（開催後・総合評価は種目横断で集計）、お気に入り・
主催者フォロー、種目別プロフィール、マイページ（主催/お気に入り）。

**施設（facility）**: 地域検索・施設詳細・施設レビュー投稿、現在地周辺検索（PostGIS RPC・補助）、
施設登録/修正申請、運営者ダッシュボード、運営者サブスク（Stripe Checkout/Portal/Webhook）。

**管理（admin）**: ダッシュボード、利用者管理、通報対応、施設申請承認、カテゴリ管理、
CSV取り込み。書き込みはサービスロール＋`core.audit_logs` 記録。

## 本番化メモ

- **型生成**: 現状ドメイン型は `packages/shared-types` に手書き。本番は `pnpm db:types` で
  Supabase 生成型に置き換える（CLAUDE.md 方針）。
- **サブドメイン Cookie 共有**: `NEXT_PUBLIC_COOKIE_DOMAIN=.lykuro.ai` を設定すると、
  account でログイン後に全種目サブドメインでセッションを共有できる（未設定はローカル開発）。
- **Realtime**: チャット新着購読には対象テーブルが publication に登録済み（0013）。

## 未実装（将来拡張）

地図タイル表示（プロバイダ未選定）、オンライン予約、AI推薦、LINE/Apple/電話番号ログイン、
ネイティブアプリ、個別メッセージ。MVP（仕様 §12.1）はおおむね充足。詳細は §12.2 / §14。
