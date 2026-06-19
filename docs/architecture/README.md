# スポともパーク：共通ユーザ基盤＋種目別ドメイン分離 設計変更案

> 依頼元: `spotomo_park_claude_code_request.md`
> ステータス: **提案（実装前）**。本ディレクトリは「変更案」であり、まだコードは変更していない。

このディレクトリは、以下の成果物に対応する。

| # | 成果物 | ドキュメント |
|---|--------|--------------|
| 1 | requirements.md への追記案 | 本書 §6 |
| 2 | 全体構成図 | 本書 §3 |
| 3 | DBテーブル設計案 | [`database_design.md`](./database_design.md) |
| 4 | API設計案 | [`api_screen_design.md`](./api_screen_design.md) §1 |
| 5 | 画面構成案 | [`api_screen_design.md`](./api_screen_design.md) §2 |
| 6 | 種目追加時の拡張ルール | [`database_design.md`](./database_design.md) §5 |
| 7 | サブプロジェクト構成案 | [`monorepo_structure.md`](./monorepo_structure.md) |
| 8 | モノレポ構成案 | [`monorepo_structure.md`](./monorepo_structure.md) |

---

## 1. 結論（確定方針）

依頼の意図（**ユーザ管理を一か所に集約し、種目を疎結合に増やせる構成**）に賛同。
協議の結果、以下を**確定方針**とする（2026-06-19 決定）。

| 論点 | 決定 |
|---|---|
| コード構成 | **最初から `apps/*` 物理分割モノレポ**（`web` / `account` / `golf` / `running` / `outdoor` / `facility` / `admin`）|
| DB | **1 Supabase・PostgreSQL スキーマ分離**（`account` / `core` / `facility` / `golf` / `running` / `outdoor`）|
| 認証 | Supabase Auth 1本・共通 `user_id`（変更なし）|
| ドメイン | サブドメインごとに独立デプロイ（`golf.spotomo-park.jp` 等）|
| 既存データ | **実データ無し（クリーンスタート）** → 移行スクリプト不要。既存 `public` スキーマは破棄して再構築可 |
| `services/*-api` | 当面作らず、各 app の Next.js Route Handlers / Server Actions に内包。切り出しが要るドメインのみ後で昇格 |

**実データが無いため、慎重なデータ移行ではなく「クリーンな再構築」で進められる**のが最大の追い風。
`alter table set schema` でのリネーム移動ではなく、新スキーマで定義し直してよい。

> `services/*-api` を最初から6本立てる必要は薄いと判断（API分離の境界は `packages/` とスキーマで
> 既に引けているため、後からプロセス分離しても疎結合は崩れない）。ここだけは「物理分割は app 層に留め、
> API層は必要時昇格」を推奨として残す。異論あれば services も同時に立てる。

---

## 2. 現状（変更前）の構成と「ここが依頼と食い違う」点

現状は **単一 Next.js（App Router / Server Actions）＋ 単一 Supabase（public スキーマ・約22テーブル）**。
種目は `sports` テーブル（自己参照カテゴリツリー）で表現し、`recruitments.sport_id` / `facility_sports` が参照する。
つまり **「種目」はデータ上のフィルタ条件**であって、ドメイン境界ではない。

依頼との主な差分は次の3点。

1. **種目別テーブルが無い**
   現状: `recruitments` 1テーブルに全種目の募集が同居（`sport_id` で区別）。
   依頼: `golf_events` / `running_events` / `outdoor_events` のように種目別に分離。
2. **共通プロフィールに種目固有項目は無い（ここは現状すでに依頼に適合）**
   現状の `profiles` は汎用項目のみ。種目固有（ハンディキャップ等）は `user_sports`（汎用）に薄く持つだけ。
   依頼: `golf_user_profiles` 等の種目別プロフィールに分離 → 現状を**置き換え**る方向。
3. **アプリ/サービスが1つ**
   現状: `src/app/*` に全機能が同居。
   依頼: account / golf / running / outdoor / facility / admin に分離。

> 補足: `users`（非公開認証データ）と `profiles`（公開）の分離、RLS、`notifyUser()` 集約などの
> **プライバシー設計は既に依頼の「共通ユーザ管理」思想と一致**している。ここは活かす。

---

## 3. 変更後の全体構成図（段階1基準）

```text
                         ┌──────────────────────────────┐
                         │  spotomo-park.jp（web/トップ） │
                         └───────────────┬──────────────┘
                                         │
          ┌───────────────┬─────────────┼──────────────┬───────────────┐
          ▼               ▼             ▼              ▼               ▼
  account.spotomo   golf.spotomo  running.spotomo  outdoor.spotomo  facility.spotomo
  （共通ユーザ管理）  （ゴルフ）     （ランニング）    （アウトドア）   （施設運営者）
          │               │             │              │               │
          │   すべて共通 user_id を参照（種目側は認証情報を持たない）        │
          ▼               ▼             ▼              ▼               ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                     Supabase（1プロジェクト）                          │
  │                                                                       │
  │  ┌── account スキーマ（共通ユーザ基盤・唯一の認証/PII保有）──┐         │
  │  │  auth.users(Supabase) ─ account.users / profiles / user_roles      │
  │  │  account.verifications / notification_settings / billing_customers │
  │  │  account.terms_agreements                                          │
  │  └────────────────────────────────────────────────────────┘         │
  │                                                                       │
  │  ┌── core スキーマ（種目横断の共有概念）──────────────────┐           │
  │  │  core.sports（カテゴリツリー） core.notifications                   │
  │  │  core.reports  core.blocks  core.audit_logs                        │
  │  └────────────────────────────────────────────────────────┘         │
  │                                                                       │
  │  ┌─ facility スキーマ ─┐ ┌─ golf ─┐ ┌─ running ─┐ ┌─ outdoor ─┐      │
  │  │ facilities          │ │ profiles│ │ profiles  │ │ profiles  │      │
  │  │ facility_sports     │ │ events  │ │ events    │ │ spots     │      │
  │  │ facility_features   │ │ partic. │ │ courses   │ │ events    │      │
  │  │ facility_images     │ │ reserv. │ │ records   │ │ partic.   │      │
  │  │ facility_submissions│ │ scores  │ │ ...       │ │ gear ...  │      │
  │  │ facility_reviews    │ └─────────┘ └───────────┘ └───────────┘      │
  │  └─────────────────────┘   ↑すべて account.users(user_id) を FK 参照   │
  └─────────────────────────────────────────────────────────────────────┘

  admin.spotomo（運営管理画面）— サービスロールで全スキーマ横断、audit_logs 記録
```

**依存方向（厳守）**

```text
golf / running / outdoor / facility  ──依存可──▶  account, core, packages/*
account, core                        ──依存不可──▶ 種目ドメイン（逆参照しない）
種目ドメイン同士                       ──依存不可──▶ 互いに直接参照しない
```

この一方向依存が「疎結合」の実体。種目を1つ消しても account / core / 他種目は無傷。

---

## 4. 既存設計への影響範囲

| 領域 | 影響 | 対応方針 |
|---|---|---|
| **認証 (`src/lib/auth.ts`, `src/proxy.ts`)** | 小。共通基盤として `account` に集約するが、Supabase Auth 1本は維持 | `account` パッケージへ移設。`user_id` 発行ロジックは不変 |
| **profiles** | 中。汎用 `profiles`（公開情報）は残し、種目固有を `*_user_profiles` へ新設 | `profiles` から種目色を排除（現状ほぼ達成済）。`user_sports` の skill_level 等は種目別プロフィールへ移行 |
| **recruitments / participants** | **大**。種目別 `*_events` / `*_participants` に分割 | 段階1ではまず **golf** を切り出し、running/outdoor は雛形踏襲。共通の状態遷移ロジックは `packages/domain-common` で共有 |
| **chat / notifications** | 中。募集（=種目イベント）ごとのチャットは種目側、通知は `core` に集約 | `notifyUser()` は `core` に移設し全種目から利用 |
| **facilities** | 中。種目横断で参照されるため独立スキーマ `facility` に | `facility_sports` で種目に紐付け。施設は共有資産として1か所維持（種目ごとに複製しない）|
| **reports / blocks / audit_logs** | 小。安全系は `core` に集約 | スキーマ移動のみ |
| **billing (`src/lib/billing.ts`, `stripe/`)** | 小。決済顧客IDは共通ユーザ基盤の役割（依頼§共通ユーザ管理に明記） | `account.billing_customers` として共通側へ。施設サブスク等の種目別課金は各ドメインが `customer_id` を参照 |
| **admin** | 中。全スキーマ横断の管理が必要 | `admin` サブプロジェクトに集約、サービスロール継続 |
| **RLS** | **大**。スキーマ単位でポリシー再設計 | 原則は不変（`account.users` 基準の `auth.uid()` 判定）。スキーマをまたぐ FK 参照の RLS に注意（§DB設計）|

**やらないこと（重要）**

- `facilities` を種目ごとに複製しない（1施設で複数種目を扱うため。`facility_sports` で多対多）。
- `core.notifications` / `reports` / `blocks` を種目ごとに分割しない（種目横断のため共通化）。
- LINE / Apple ログインは依頼の認証方式に挙がるが、**MVP後回し方針（CLAUDE.md）に従い枠だけ用意し実装は据え置き**。

---

## 5. 移行ステップ（段階1の実行順）

依頼書の「コード修正を始める前に方針を整理」に従い、承認後の想定手順のみ提示（本提案では未実施）。

1. `packages/` の骨組み作成（`shared-types` / `auth-client` / `domain-common` / `api-client` / `shared-ui`）。
2. DBスキーマ分離マイグレーション `0009_schema_split.sql`（`public` → `account`/`core`/`facility`、種目スキーマ新設）。**既存データは `alter table ... set schema` でリネーム移動、破壊的変更は最小化**。
3. 既存 `recruitments` → `golf.events` への移行（MVPの実データはゴルフ前提なら単純コピー、複数種目混在なら `sport_id` で振り分け）。
4. `src/app` をルートグループ `(account)` / `(golf)` / `(facility)` / `admin` に再編。
5. running / outdoor は golf 雛形を複製して最小機能から。

各ステップは独立PRに分割し、`npm run build`（型チェック込み）で都度検証する。

---

## 6. requirements.md への追記案（成果物#1）

`sports_leisure_platform_requirements.md` に新章 **「16. 共通ユーザ基盤と種目別ドメイン分離」** を追加する。差し込む文面：

> ### 16. プラットフォーム構成方針（共通ユーザ基盤＋種目別ドメイン）
>
> 16.1 本サービスは、共通ユーザ管理基盤を中心に、ゴルフ・ランニング・アウトドア等の
> 種目別サービスを独立したドメインとして構成する。ユーザは一つのアカウントで複数の
> 種目サービスを利用できる。
>
> 16.2 共通ユーザ管理は、会員登録・ログイン・本人確認・プロフィール（共通部）・通知設定・
> 決済情報・利用規約同意・退会処理を集約する。全種目で共通して利用する情報のみを保持し、
> 種目固有項目（ハンディキャップ、走力等）を共通ユーザテーブルに直接追加しない。
>
> 16.3 各種目サービスは共通 `user_id` を参照し、種目固有のプロフィール・施設紐付け・イベント
> （＝仲間募集）・参加・予約・スコア・参加履歴を独立して管理する。種目テーブルに
> ログイン情報・認証情報を持たせない。
>
> 16.4 ログインは全種目共通とする（メール・Google を MVP 提供。Apple・LINE・電話番号認証は
> 将来拡張）。ログイン後に共通 `user_id` を発行し、各種目ドメインはこれを参照して
> 利用者情報を取得する。
>
> 16.5 種目の追加は、既存種目のソース・共通テーブルに混在させず、独立したサブプロジェクトと
> 種目専用テーブル群として追加する。共通ユーザ管理は変更しない。共通UI・型・認証クライアント・
> APIクライアントは共有パッケージ（`packages/`）として再利用する。
>
> 16.6 施設情報は種目横断の共有資産とし、種目ごとに複製しない。施設と種目の対応は
> 多対多（`facility_sports`）で表現する。通報・ブロック・監査ログ・通知は種目横断の
> 共通機能として一元管理する。

§8（DB基本設計）・§10（API構成）・§7（画面一覧）には、各設計ドキュメントへの参照リンクを追記する。
```
