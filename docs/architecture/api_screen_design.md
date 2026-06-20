# API設計案（#4）・画面構成案（#5）

## 1. API設計案（#4）

### 1.1 方針

- 認証・ユーザは **account ドメインに集約**。種目APIは認証情報を一切持たず、
  検証済みの `user_id`（共通 JWT の `sub`）を受け取るだけ。
- ルートは依頼のドメイン分割に合わせ **ドメイン別プレフィックス**を付ける。
  段階1は単一 Next.js の `app/api/<domain>/...`、段階2は `services/<domain>-api` の独立エンドポイント。
- 認可は各APIが `account.users` 基準で実施（種目APIはトークン検証 → `user_id` 取得 → 自分のスキーマのRLS）。

### 1.2 ドメイン別エンドポイント

```text
# account-api（共通ユーザ基盤・唯一の認証保有者）
POST   /api/account/auth/signup            メール登録
POST   /api/account/auth/login             ログイン（メール/Google。Apple/LINE/電話は将来）
POST   /api/account/auth/logout
GET    /api/account/me                     共通ユーザ情報（自分のみ）
GET    /api/account/profile/{user_id}      公開プロフィール（PII除外）
PATCH  /api/account/profile                共通プロフィール更新
GET/PATCH /api/account/notification-settings
POST   /api/account/verification           本人確認申請
POST   /api/account/terms/agree
GET    /api/account/billing/customer       決済顧客（stripe_customer_id）
DELETE /api/account/me                     退会処理

# 共通カタログ（core）
GET    /api/sports                         種目カテゴリツリー

# golf-api（種目。running/outdoor も同型）
GET    /api/golf/profile/{user_id}         ゴルフ用プロフィール
PUT    /api/golf/profile                   自分のゴルフ用プロフィール
GET    /api/golf/events                    募集一覧/検索（種目内）
POST   /api/golf/events                    募集作成
GET    /api/golf/events/{id}               募集詳細
POST   /api/golf/events/{id}/apply         参加申請
POST   /api/golf/events/{id}/approve       承認（主催者）
POST   /api/golf/events/{id}/reject
POST   /api/golf/events/{id}/cancel
GET    /api/golf/events/{id}/participants
POST   /api/golf/events/{id}/reservations  予約（将来）
POST   /api/golf/events/{id}/scores        スコア登録
# chat はイベント単位（Supabase Realtime 併用）
GET    /api/golf/events/{id}/messages
POST   /api/golf/events/{id}/messages

# facility-api（種目横断の共有資産・施設運営者向け）
GET    /api/facilities                      地域/駅/地図/半径検索（種目で絞り込み可）
GET    /api/facilities/{id}
POST   /api/facilities/submissions          利用者の登録/修正申請
POST   /api/facilities/{id}/reviews
GET    /api/facilities/nearby               現在地周辺（補助機能）
# 施設運営者
GET/PATCH /api/facility-owner/facilities/{id}

# admin-api（運営・全ドメイン横断、サービスロール）
GET    /api/admin/users
POST   /api/admin/users/{id}/suspend
GET    /api/admin/reports
POST   /api/admin/reports/{id}/resolve
POST   /api/admin/facility-submissions/{id}/review
GET    /api/admin/sports                     カテゴリ管理
POST   /api/admin/facilities/import          CSV取り込み

# core（横断）
GET    /api/notifications
POST   /api/reports
POST   /api/blocks
```

### 1.3 既存からの移行マッピング

| 既存（単一アプリ） | 変更後 |
|---|---|
| `src/app/recruitments/actions.ts` | `app/(golf)/.../actions.ts`（→ 段階2: golf-api）|
| `src/lib/auth.ts` | `packages/auth-client` + account-api |
| `src/lib/notify.ts` | `packages/domain-common`（core.notifications へ INSERT）|
| `src/lib/billing.ts` / `stripe/` | account-api（billing_customers は共通側）|
| `src/app/admin/*` | `app/admin/*`（→ 段階2: admin-api）|
| `src/app/facilities/*` | `app/(facility)/*` / facility-api |

> 種目間でAPI形状を揃えるため、`golf` のエンドポイント定義を **OpenAPI 雛形**として
> `packages/api-client` に置き、running/outdoor は種目名と固有フィールドのみ差し替える。

---

## 2. 画面構成案（#5）

ドメイン（サブドメイン）ごとに画面を分割。共通ヘッダ/フッタ/種目スイッチャは `packages/shared-ui`。

```text
spotomo.lykuro.ai（web）
  /                     トップ（種目選択ハブ）→ 各種目サブドメインへ誘導
  /about /terms /privacy

account-spotomo.lykuro.ai（共通ユーザ管理）
  /login /signup        ログイン・会員登録（全種目共通）
  /profile              共通プロフィール編集（nickname/area/自己紹介）
  /verification         本人確認
  /notifications/settings
  /billing              決済情報
  /withdraw             退会
  ※ ログイン成功 → 共通 user_id 発行 → 直前の種目サブドメインへ戻す

golf-spotomo.lykuro.ai（ゴルフ。running/outdoor も同型）
  /                     ゴルフ・トップ（募集一覧/検索）
  /events               募集検索（地域・日時・スキル）
  /events/new          募集作成
  /events/[id]          募集詳細・参加申請
  /events/[id]/chat     グループチャット
  /events/[id]/review   相互評価（開催後）
  /profile              ゴルフ用プロフィール（ハンディキャップ等）
  /mypage               参加履歴・スコア・お気に入り（種目内）

facility-spotomo.lykuro.ai（施設運営者）
  /                     管理する施設一覧
  /facilities/[id]/edit
  /facilities/submit    登録/修正申請（一般利用者導線もここへ）

admin-spotomo.lykuro.ai（運営管理）
  /                     ダッシュボード
  /users /reports /facilities/submissions /sports /facilities/import
  ※ 多要素認証必須（仕様§11.1）
```

### 2.1 画面遷移（ログイン・認証フロー）

```text
任意の種目サブドメインで「ログインが必要な操作」
   ↓ 未ログインなら account-spotomo.lykuro.ai/login へ（return_to 付き）
ログイン（メール/Google）
   ↓ 共通 user_id を持つセッション発行（Supabase Auth・サブドメイン間でCookie共有）
return_to の種目サブドメインへ復帰
   ↓ 種目側は user_id で account.profiles と自種目プロフィールを取得
種目機能を利用
```

> サブドメイン間セッション共有は、Cookie ドメインを `.lykuro.ai` に設定して実現
> （段階1のパスベース運用なら単一ドメインで自然に共有）。

### 2.2 既存画面の振り分け

| 既存 `src/app/` | 行き先 |
|---|---|
| `(auth)`, `auth`, `profile` | account |
| `recruitments`, `chat`, `mypage`, `favorites` | 各種目（まず golf）|
| `facilities` | facility |
| `admin` | admin |
| `notifications`, `reports`, `blocks` | core 共通（各サブドメインのヘッダから利用）|
```
