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
リダイレクト URL に `http://localhost:3000/auth/callback` を登録する。

### 5. 開発サーバー

```bash
npm run dev      # http://localhost:3000
```

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（Turbopack） |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` による型チェック |

## 実装済み機能（MVP フェーズ1〜4の中核）

- メール／Google ログイン、会員登録、ログアウト（`src/app/(auth)`）
- 公開プロフィール編集（`/profile/edit`）
- 募集の一覧・検索（種目・地域・並び替え・初心者可）（`/recruitments`）
- 募集詳細、参加申請、主催者による承認／拒否、本人キャンセル（`/recruitments/[id]`）
- 募集作成（承認制・先着順）（`/recruitments/new`）
- 募集ごとのグループチャット（承認済みメンバーのみ）（`/chat/[id]`）
- 施設の一覧・地域検索（`/facilities`）、施設詳細・施設レビュー（`/facilities/[id]`）
- 開催終了後の相互評価（主催者⇔参加者、`profiles` 集計を自動更新）（`/recruitments/[id]/review`）
- マイページ（主催／参加した募集）（`/mypage`）
- 通報（募集詳細から、仕様 §6.11）、施設登録申請（`/facilities/submit`）・修正申請（施設詳細）
- お気に入り・主催者フォロー（`/mypage/favorites`）、ブロック（`/mypage/blocks`、参加申請を制限）
- アプリ内通知一覧（`/notifications`、未読バッジ）＋メール通知（Resend、任意）
- 現在地周辺の施設検索（PostGIS `nearby_facilities`、距離順）
- 管理画面（`/admin`）— ダッシュボード、利用者管理（停止/復帰）、募集管理（中止）、
  通報対応、施設登録申請の承認/却下、CSV取り込み、カテゴリー公開管理。監査ログ記録付き
- 全21テーブルのスキーマ + RLS + 評価集計/通知トリガー + 近傍検索RPC

## 主なディレクトリ

```
src/
  app/                 App Router（ページ + Server Actions）
    (auth)/            ログイン・登録・認証アクション
    recruitments/      募集（一覧・詳細・作成・参加アクション）
    chat/[id]/         グループチャット
    facilities/        施設検索
    profile/edit/      プロフィール編集
    mypage/            ダッシュボード
  components/          共有 UI コンポーネント
  lib/
    supabase/          browser / server / proxy 用クライアント
    recruitments.ts    募集データ取得ロジック
    constants.ts       都道府県・各種ラベル
  proxy.ts             セッション更新 + 会員専用パス保護
supabase/
  migrations/          0001_init.sql（スキーマ） / 0002_rls.sql（RLS）
  seed.sql             スポーツカテゴリー
```

## 未実装（仕様の後続フェーズ／将来拡張）

地図タイル表示（地図プロバイダ未選定）、オンライン予約・決済、AI推薦、LINE連携、
ネイティブアプリ。MVP（仕様 §12.1）の機能はおおむね実装済み。詳細は §12.2 / §14 を参照。
