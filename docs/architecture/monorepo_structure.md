# サブプロジェクト構成案（#7）・モノレポ構成案（#8）

## 1. 推奨：段階的モノレポ

依頼書の目標構成（`apps/` + `packages/` + `services/`）を**最終形**として採用しつつ、
MVPを止めないため**段階1はモジュラモノリス**から入る。境界（パッケージ依存方向）は段階1で確定させ、
段階2の物理分割を機械的にする。

### 1.1 ツール選定

- **パッケージマネージャ**: pnpm workspaces（npm workspaces でも可。現状 npm のため移行は任意）。
- **タスクランナー**: Turborepo（ビルドキャッシュ・依存グラフ実行）。
- **言語/FW**: 既存どおり Next.js 16 + TypeScript + Supabase を全 apps で踏襲。
- **共有Supabase型**: 本番は `supabase gen types` 生成型を `packages/shared-types` に集約
  （CLAUDE.md の「untyped クライアント＋手書き型」方針を、この機会に生成型へ寄せる）。

---

## 2. 最終形（段階2）ディレクトリ

```text
spotomo-park/
  apps/
    web/                 # spotomo-park.jp トップ・種目ハブ
    account/             # account.spotomo-park.jp 共通ユーザ管理（唯一の認証UI）
    golf/                # golf.spotomo-park.jp
    running/             # running.spotomo-park.jp
    outdoor/             # outdoor.spotomo-park.jp
    facility/            # facility.spotomo-park.jp 施設運営者向け
    admin/               # admin.spotomo-park.jp 運営管理
  packages/
    shared-ui/           # 共通UI（ヘッダ/種目スイッチャ/フォーム部品）
    shared-types/        # 共通型・Supabase生成型・enum/状態遷移カタログ
    auth-client/         # 共通認証クライアント（Supabase Auth ラッパ。種目側はこれ経由のみ）
    api-client/          # 各ドメインAPIの型付きクライアント（OpenAPI由来）
    domain-common/       # 共通ドメインロジック（募集/参加の状態遷移, notifyUser, RLSヘルパ）
    config/              # eslint / tsconfig / tailwind 共有設定
  services/              # 段階2で必要時のみ。Next.js API で足りる間は作らない
    account-api/
    golf-api/  running-api/  outdoor-api/  facility-api/  admin-api/
  supabase/
    migrations/          # 既存 0001-0008 + 0009_schema_split.sql 以降
  docs/
    requirements.md      # = sports_leisure_platform_requirements.md
    database_schema.md   # = architecture/database_design.md
    api_design.md        # = architecture/api_screen_design.md
  turbo.json
  pnpm-workspace.yaml
```

> `services/*-api` は **最初から作らない**。Next.js の Server Actions / Route Handlers で
> 各 app が自前ドメインのAPIを内包すれば十分。「APIを別プロセスに切り出す必要が出たドメインだけ」
> services へ昇格させる（疎結合の境界は packages とスキーマで既に引けているため移動は容易）。

### 2.1 依存ルール（package.json / eslint で強制）

```text
apps/golf      → packages/{auth-client, api-client, shared-ui, shared-types, domain-common}
apps/account   → packages/{shared-ui, shared-types, domain-common}   ※ 種目に依存しない
packages/*     → 他 packages（循環禁止）
apps 同士       → 相互依存禁止（共有は必ず packages 経由）
種目 app 同士    → 相互依存禁止
```

`eslint` の `no-restricted-imports` か `dependency-cruiser` でこの方向違反をCIで弾く。

---

## 3. 段階1（今すぐ・MVP継続）の構成

物理的に1 Next.js のまま、**ルートグループ**でドメインを切り、`packages/` だけ先に作る。

```text
spotomo-park/
  app/
    (web)/               # トップ
    (account)/           # login, signup, profile, billing, verification, withdraw
    (golf)/              # events, chat, mypage, golf profile
    (facility)/          # facilities, submit
    admin/               # 管理
    api/<domain>/...     # ドメイン別 Route Handlers
  packages/
    shared-types/ auth-client/ domain-common/ api-client/ shared-ui/
  supabase/migrations/   # 0009_schema_split.sql でスキーマ分離
```

サブドメイン（`golf.spotomo-park.jp` 等）は、段階1では Vercel の rewrites か
ホスト名→ルートグループのマッピングで対応し、段階2で `apps/*` の独立デプロイに移行する。

### 3.1 段階1 → 段階2 の移行が機械的になる理由

1. DBは段階1で既にスキーマ分離済み（テーブル移動不要）。
2. ドメインロジックは `packages/` に集約済み（app は薄いUI層）。
3. ルートグループ `(golf)` を `apps/golf` にフォルダ移動するだけで独立アプリ化できる。
4. 依存方向はCIで強制済みなので、切り出し時に隠れ依存が発覚しない。

---

## 4. 種目追加の最終ルール（#6 と対）

```text
新種目 tennis を追加する場合:
  apps/tennis/            ← apps/golf を雛形に複製、固有UIのみ差し替え
  （必要なら）services/tennis-api/
  packages/shared-types に tennis ドメイン型を追加
  supabase: create schema tennis + golf雛形テーブルを複製
  core.sports に tennis ルート行を追加

  変更してはいけないもの:
    apps/account, packages/auth-client（共通ユーザ管理は不変）
    account.* / core.* / facility.* の既存テーブル
```

---

## 5. 決定事項（2026-06-19）

| # | 論点 | 決定 |
|---|---|---|
| 1 | コード構成 | **最初から `apps/*` 物理分割**（モジュラモノリス段階を踏まない）|
| 2 | DB分離方式 | **PostgreSQL スキーマ分離**（`golf.events`）|
| 3 | 既存データ | **実データ無し** → 移行不要・クリーン再構築。`public` スキーマは破棄して再定義 |

未確定（実装着手前に確認）：

- パッケージマネージャを **pnpm + Turborepo** へ移行して良いか（現状 npm。モノレポ運用上は推奨）。
- `services/*-api` を最初から立てるか、各 app の Route Handlers 内包で始めるか（推奨は後者）。
- Apple/LINE/電話番号ログインは枠のみ（CLAUDE.md の後回し方針準拠）で良いか。

## 6. 実装着手プラン（apps/* 物理分割・スキーマ分離・クリーンスタート）

実データが無いため、既存 `src/*` を新モノレポ構成へ作り直す。順序：

1. ルートをモノレポ化：`pnpm-workspace.yaml` / `turbo.json` / `packages/config`（eslint・tsconfig・tailwind）。
2. `packages/` 整備：`shared-types`（Supabase生成型・enum/状態遷移カタログ）→ `auth-client` → `domain-common` → `api-client` → `shared-ui`。
3. Supabaseスキーマ再定義：`0009_` 以降で `account` / `core` / `facility` を新規定義し、既存 `public` の該当テーブルを移行（データ無しなので drop & recreate 可）。
4. `apps/account` 構築（既存 auth/profile を移植）→ 認証が全 app の前提のため最優先。
5. `apps/golf` 構築（既存 recruitments/chat/mypage を `golf.events` ベースへ移植）＝種目の基準雛形。
6. `apps/facility` / `apps/admin` 構築。
7. `apps/running` / `apps/outdoor` を golf 雛形から複製し最小機能で起動。
8. `apps/web`（トップ・種目ハブ）。

各 app は `pnpm --filter <app> build` で型チェック込み検証。依存方向違反は CI で `dependency-cruiser` により遮断。
```
