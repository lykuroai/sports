# Spotomo マイページ画面設計書 v1.0

## 1. 文書情報

| 項目 | 内容 |
|---|---|
| 文書名 | Spotomo マイページ画面設計書 |
| バージョン | v1.0 |
| 対象サービス | Spotomo：スポーツ・レジャー仲間募集サービス |
| 前提仕様 | 1サイト集約仕様、共通ユーザー管理、共通施設DB、種目別カテゴリ表示 |
| 対象画面 | マイページ、プロフィール編集、参加管理、募集管理、保存一覧、通知、アカウント設定 |

---

## 2. 目的

マイページは、利用者が1つのアカウントで、ゴルフ、ランニング、アウトドア、球技、フィットネス、レジャーなど複数種目の活動を横断的に管理するための個人用画面である。

主な目的は以下とする。

1. 自分のプロフィールを管理する
2. 参加予定の仲間募集を確認する
3. 自分が作成した仲間募集を管理する
4. 応募・参加履歴を確認する
5. 保存した施設・募集を確認する
6. 通知・メッセージを確認する
7. アカウント・公開設定を管理する

---

## 3. 基本方針

```text
サイト: 1つ
アカウント: 1つ
マイページ: 1つ
対象種目: 複数
表示方法: 種目・状態・日付でフィルタ
```

マイページは種目ごとに分けず、全種目を1画面で統合管理する。
ただし、一覧では種目タグを表示し、必要に応じて種目で絞り込めるようにする。

例：

```text
マイページ
  ├─ プロフィール
  ├─ 参加予定
  ├─ 作成した募集
  ├─ 応募・参加履歴
  ├─ 保存した施設
  ├─ 保存した募集
  ├─ 通知
  └─ 設定
```

---

## 4. 対象ユーザー

| ユーザー種別 | 利用内容 |
|---|---|
| 一般ユーザー | 仲間募集への参加、保存、プロフィール編集 |
| 募集作成者 | 仲間募集の作成、編集、参加者管理 |
| 施設管理者 | 自施設情報の確認、修正申請、関連募集確認 |
| 管理者 | ユーザー状態確認、違反対応、本人確認状況確認 |

本画面の主対象は一般ユーザーおよび募集作成者とする。

---

## 5. 画面URL設計

| 画面 | URL | 認証 |
|---|---|---|
| マイページトップ | `/mypage` | 必須 |
| プロフィール編集 | `/mypage/profile` | 必須 |
| 参加予定一覧 | `/mypage/participations` | 必須 |
| 作成した募集一覧 | `/mypage/recruitments` | 必須 |
| 応募・参加履歴 | `/mypage/history` | 必須 |
| 保存した施設 | `/mypage/saved-facilities` | 必須 |
| 保存した募集 | `/mypage/saved-recruitments` | 必須 |
| 通知一覧 | `/mypage/notifications` | 必須 |
| アカウント設定 | `/mypage/settings` | 必須 |
| 公開プロフィール | `/users/{user_id}` | 任意 |

---

## 6. マイページ全体構成

### 6.1 PCレイアウト

```text
┌──────────────────────────────────────────────┐
│ Header                                       │
├──────────────────────────────────────────────┤
│ マイページ                                   │
│                                              │
│ ┌──────────────┐ ┌─────────────────────────┐ │
│ │ Profile Card │ │ Dashboard Summary       │ │
│ │              │ │ 参加予定 / 作成募集 / 通知 │ │
│ └──────────────┘ └─────────────────────────┘ │
│                                              │
│ ┌──────────────┐ ┌─────────────────────────┐ │
│ │ Side Menu    │ │ Main Content            │ │
│ │ - 参加予定    │ │ タブごとの一覧           │ │
│ │ - 作成募集    │ │                         │ │
│ │ - 保存施設    │ │                         │ │
│ │ - 通知        │ │                         │ │
│ │ - 設定        │ │                         │ │
│ └──────────────┘ └─────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 6.2 スマホレイアウト

```text
┌────────────────────┐
│ Header             │
├────────────────────┤
│ Profile Summary    │
├────────────────────┤
│ Dashboard Cards    │
│ 参加予定 / 通知      │
├────────────────────┤
│ Horizontal Tabs     │
│ 参加予定 作成 保存 通知 │
├────────────────────┤
│ List Content        │
└────────────────────┘
```

スマホではサイドメニューを使用せず、横スクロールタブまたは下部メニューで切り替える。

---

## 7. マイページトップ仕様

### 7.1 表示項目

| 項目 | 内容 |
|---|---|
| プロフィール画像 | ユーザーのアイコン画像 |
| 表示名 | ニックネームまたは氏名 |
| 自己紹介 | 短いプロフィール文 |
| 主な種目 | ゴルフ、ランニング、アウトドア等 |
| 活動エリア | 都道府県、市区町村 |
| 参加予定数 | 今後参加予定の募集数 |
| 作成中募集数 | 自分が作成した公開中募集数 |
| 未読通知数 | 未読通知・メッセージ数 |
| 保存施設数 | お気に入り登録した施設数 |

### 7.2 ダッシュボードカード

```text
参加予定
作成した募集
応募中
保存施設
通知
プロフィール完成度
```

### 7.3 CTA

| CTA | 遷移先 |
|---|---|
| 仲間募集を作成する | `/recruitments/new` |
| プロフィールを編集する | `/mypage/profile` |
| 施設を探す | `/facilities` |
| 種目から探す | `/sports` |

---

## 8. プロフィール画面仕様

### 8.1 基本情報

| 項目 | 必須 | 公開範囲 | 備考 |
|---|---:|---|---|
| プロフィール画像 | 任意 | 公開 | 初期はデフォルト画像 |
| 表示名 | 必須 | 公開 | ニックネーム可 |
| 性別 | 任意 | 任意公開 | 募集条件で使う場合あり |
| 年代 | 任意 | 公開/非公開 | 20代、30代等 |
| 活動エリア | 任意 | 公開 | 都道府県・市区町村 |
| 自己紹介 | 任意 | 公開 | 最大1000文字 |
| 主な種目 | 任意 | 公開 | 複数選択可 |
| レベル | 任意 | 公開 | 初心者、中級者、上級者等 |

### 8.2 種目別プロフィール

種目ごとに任意入力できる。

例：ゴルフ

```text
平均スコア
よく行くエリア
プレースタイル
平日/休日参加可否
```

例：ランニング

```text
走力レベル
5km / 10km / ハーフ / フル経験
平均ペース
参加したい大会種別
```

例：アウトドア

```text
好きな活動
キャンプ経験
登山経験
車の有無
道具の有無
```

---

## 9. 参加予定画面仕様

### 9.1 対象データ

ユーザーが参加予定、応募中、承認済みになっている仲間募集を表示する。

### 9.2 表示項目

| 項目 | 内容 |
|---|---|
| 種目タグ | ゴルフ、ランニング、アウトドア等 |
| 募集タイトル | 仲間募集タイトル |
| 開催日時 | 日付・開始時間 |
| 施設名 | 関連施設 |
| 場所 | 都道府県・市区町村 |
| 参加状態 | 応募中、承認済み、キャンセル済み |
| 主催者 | 募集作成者 |
| 操作 | 詳細、キャンセル、メッセージ |

### 9.3 ステータス

```text
applied     応募中
approved    参加承認済み
rejected    却下
cancelled   キャンセル済み
completed   開催終了
```

### 9.4 フィルタ

```text
すべて
今後の予定
応募中
承認済み
終了済み
キャンセル済み
種目別
```

---

## 10. 作成した募集画面仕様

### 10.1 対象データ

ログインユーザーが作成した仲間募集を表示する。

### 10.2 表示項目

| 項目 | 内容 |
|---|---|
| 募集タイトル | 作成した募集のタイトル |
| 種目 | 対象種目 |
| 開催日時 | 実施日時 |
| 施設 | 関連施設 |
| 募集人数 | 定員・現在人数 |
| 応募数 | 応募中人数 |
| 公開状態 | 公開、下書き、終了、非公開 |
| 操作 | 編集、参加者管理、締切、削除 |

### 10.3 募集ステータス

```text
draft       下書き
open        募集中
full        満員
closed      締切
cancelled   中止
completed   終了
hidden      非公開
```

### 10.4 参加者管理

募集作成者は以下を操作できる。

```text
応募者一覧を見る
応募者を承認する
応募者を却下する
参加者にメッセージを送る
募集を締め切る
募集を中止する
```

---

## 11. 応募・参加履歴画面仕様

### 11.1 表示対象

過去に応募または参加した募集を表示する。

```text
参加済み
キャンセル済み
却下済み
終了済み
```

### 11.2 活用目的

1. ユーザーが過去の活動を振り返る
2. 同じ施設・同じ主催者の募集を再度探せる
3. 将来的にレビュー・評価機能へ接続する

---

## 12. 保存した施設画面仕様

### 12.1 対象データ

ユーザーがお気に入り登録した施設を表示する。

### 12.2 表示項目

| 項目 | 内容 |
|---|---|
| 施設名 | 施設名称 |
| カテゴリ | ゴルフ場、体育館、公園、キャンプ場等 |
| 対応種目 | 複数表示 |
| 住所 | 都道府県・市区町村 |
| 予約URL | ある場合表示 |
| 保存日 | お気に入り登録日 |
| 操作 | 詳細、保存解除、募集作成 |

### 12.3 CTA

```text
この施設で仲間募集を作成
施設詳細を見る
保存を解除
```

---

## 13. 保存した募集画面仕様

### 13.1 対象データ

ユーザーが後で確認するために保存した仲間募集を表示する。

### 13.2 表示項目

```text
募集タイトル
種目
開催日時
場所
参加状況
定員
保存日
応募ボタン
保存解除ボタン
```

---

## 14. 通知画面仕様

### 14.1 通知種別

| 通知種別 | 内容 |
|---|---|
| participation | 応募・参加承認・却下 |
| recruitment | 募集の変更・締切・中止 |
| message | メッセージ受信 |
| facility | 保存施設の更新 |
| system | システム通知 |
| admin | 運営からのお知らせ |

### 14.2 通知ステータス

```text
unread  未読
read    既読
archived アーカイブ
```

### 14.3 通知操作

```text
通知詳細を見る
既読にする
すべて既読にする
通知を削除する
```

---

## 15. アカウント設定画面仕様

### 15.1 設定項目

| 項目 | 内容 |
|---|---|
| メールアドレス | ログイン・通知用 |
| パスワード | メールログイン時のみ |
| OAuth連携 | Google、LINE、Apple等 |
| 通知設定 | メール通知、アプリ内通知 |
| 公開設定 | プロフィール公開範囲 |
| ブロック管理 | ブロックしたユーザー一覧 |
| 退会 | アカウント削除申請 |

### 15.2 通知設定

```text
応募があった時
応募が承認された時
募集内容が変更された時
メッセージを受信した時
保存施設が更新された時
運営からのお知らせ
```

### 15.3 公開設定

```text
プロフィールを公開する / 非公開にする
活動エリアを公開する / 非公開にする
年代を公開する / 非公開にする
参加履歴を公開する / 非公開にする
```

---

## 16. 権限・セキュリティ設計

### 16.1 本人のみ閲覧可能な情報

```text
メールアドレス
応募中の募集
通知
メッセージ
保存施設
保存募集
アカウント設定
```

### 16.2 公開可能な情報

```text
表示名
プロフィール画像
自己紹介
主な種目
活動エリア
種目別レベル
公開中の作成募集
```

### 16.3 注意事項

1. メールアドレスは他ユーザーに表示しない
2. 応募者一覧は募集作成者のみ閲覧可能
3. 管理者は違反対応目的で必要情報を閲覧可能
4. 退会後は個人情報を削除または匿名化する
5. ブロックしたユーザーとはメッセージ・応募を制限する

---

## 17. API設計

### 17.1 マイページ取得

```http
GET /api/me/dashboard
```

レスポンス例：

```json
{
  "user": {
    "id": 1001,
    "display_name": "スポとも太郎",
    "avatar_url": "https://example.com/avatar.jpg",
    "main_sports": ["golf", "running", "outdoor"],
    "area": "東京都"
  },
  "summary": {
    "upcoming_count": 3,
    "created_open_count": 2,
    "applied_count": 1,
    "saved_facility_count": 8,
    "unread_notification_count": 4,
    "profile_completion": 70
  }
}
```

### 17.2 プロフィール取得・更新

```http
GET /api/me/profile
PUT /api/me/profile
```

### 17.3 参加予定一覧

```http
GET /api/me/participations?status=upcoming&sport=running&page=1
```

### 17.4 作成した募集一覧

```http
GET /api/me/recruitments?status=open&page=1
```

### 17.5 保存施設一覧

```http
GET /api/me/saved-facilities?page=1
```

### 17.6 保存募集一覧

```http
GET /api/me/saved-recruitments?page=1
```

### 17.7 通知一覧

```http
GET /api/me/notifications?status=unread&page=1
PATCH /api/me/notifications/{notification_id}/read
PATCH /api/me/notifications/read-all
```

### 17.8 アカウント設定

```http
GET /api/me/settings
PUT /api/me/settings
POST /api/me/withdraw
```

---

## 18. DB設計

### 18.1 users

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  area_prefecture TEXT,
  area_city TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 18.2 user_sports

```sql
CREATE TABLE user_sports (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  sport_code TEXT NOT NULL,
  level TEXT,
  note TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 18.3 user_profiles

```sql
CREATE TABLE user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  gender TEXT,
  age_group TEXT,
  visibility_profile TEXT DEFAULT 'public',
  visibility_area TEXT DEFAULT 'public',
  visibility_age_group TEXT DEFAULT 'public',
  updated_at TIMESTAMP DEFAULT now()
);
```

### 18.4 recruitment_participants

```sql
CREATE TABLE recruitment_participants (
  id BIGSERIAL PRIMARY KEY,
  recruitment_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'applied',
  message TEXT,
  applied_at TIMESTAMP DEFAULT now(),
  approved_at TIMESTAMP,
  cancelled_at TIMESTAMP
);
```

### 18.5 saved_facilities

```sql
CREATE TABLE saved_facilities (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  facility_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, facility_id)
);
```

### 18.6 saved_recruitments

```sql
CREATE TABLE saved_recruitments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  recruitment_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, recruitment_id)
);
```

### 18.7 notifications

```sql
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  related_type TEXT,
  related_id BIGINT,
  status TEXT DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT now(),
  read_at TIMESTAMP
);
```

### 18.8 user_settings

```sql
CREATE TABLE user_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  email_notification BOOLEAN DEFAULT true,
  app_notification BOOLEAN DEFAULT true,
  notify_participation BOOLEAN DEFAULT true,
  notify_message BOOLEAN DEFAULT true,
  notify_recruitment_update BOOLEAN DEFAULT true,
  notify_facility_update BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## 19. フロントエンドコンポーネント設計

```text
/pages/mypage/index.vue
/pages/mypage/profile.vue
/pages/mypage/participations.vue
/pages/mypage/recruitments.vue
/pages/mypage/history.vue
/pages/mypage/saved-facilities.vue
/pages/mypage/saved-recruitments.vue
/pages/mypage/notifications.vue
/pages/mypage/settings.vue

/components/mypage/ProfileCard.vue
/components/mypage/DashboardSummary.vue
/components/mypage/MypageTabs.vue
/components/mypage/ParticipationList.vue
/components/mypage/MyRecruitmentList.vue
/components/mypage/SavedFacilityList.vue
/components/mypage/SavedRecruitmentList.vue
/components/mypage/NotificationList.vue
/components/mypage/AccountSettingsForm.vue
```

---

## 20. 表示状態設計

### 20.1 未ログイン

マイページにアクセスした場合、ログイン画面へリダイレクトする。

```text
/mypage → /login?redirect=/mypage
```

### 20.2 プロフィール未完成

プロフィール完成度を表示し、編集を促す。

```text
プロフィールが未完成です。
主な種目・活動エリア・自己紹介を登録すると、仲間募集に参加しやすくなります。
```

### 20.3 参加予定なし

```text
参加予定の仲間募集はまだありません。
種目から探して、気になる募集に参加してみましょう。
```

### 20.4 作成募集なし

```text
作成した仲間募集はまだありません。
ゴルフ、ランニング、アウトドアなど、一緒に楽しむ仲間を募集できます。
```

### 20.5 保存施設なし

```text
保存した施設はまだありません。
気になる施設を保存すると、あとからすぐに確認できます。
```

---

## 21. 管理画面連携

管理者は以下を確認・操作できる。

```text
ユーザー一覧
ユーザー詳細
ユーザーの公開状態
違反報告履歴
募集作成履歴
参加履歴
アカウント停止
プロフィール非公開化
本人確認状態
```

ただし、プライバシー保護のため、通常運用ではメッセージ本文の閲覧は制限する。

---

## 22. MVP実装範囲

初期リリースでは、以下を実装対象とする。

```text
1. マイページトップ
2. プロフィール表示・編集
3. 参加予定一覧
4. 作成した募集一覧
5. 保存した施設一覧
6. 通知一覧
7. 基本設定
```

MVPでは以下は後続対応とする。

```text
種目別詳細プロフィール
レビュー・評価
ブロック管理
高度な公開範囲設定
施設管理者専用画面
本人確認
```

---

## 23. 実装優先順位

| 優先度 | 機能 | 理由 |
|---:|---|---|
| 1 | マイページトップ | ユーザーの活動入口になるため |
| 2 | プロフィール編集 | 仲間募集参加に必要なため |
| 3 | 参加予定一覧 | ユーザー体験の中心機能 |
| 4 | 作成募集一覧 | 募集作成者に必須 |
| 5 | 保存施設一覧 | 施設DBとの接続に有効 |
| 6 | 通知一覧 | 応募・承認フローに必要 |
| 7 | アカウント設定 | 運用上必要 |
| 8 | 履歴・レビュー | リリース後拡張 |

---

## 24. まとめ

マイページは、Spotomoの1サイト集約方針において、ユーザー活動を統合管理する中心画面である。

設計方針は以下とする。

```text
マイページは1つ
全種目を横断管理
参加予定・作成募集・保存施設・通知を統合
プロフィールは共通情報 + 種目別情報で構成
MVPでは基本機能を優先
将来、レビュー・本人確認・施設管理者機能へ拡張
```
