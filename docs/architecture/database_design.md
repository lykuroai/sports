# DBテーブル設計案（成果物#3・#6）

> 前提: Supabase 1プロジェクト。**PostgreSQL スキーマ**で論理ドメインを分離する
> （`account` / `core` / `facility` / `golf` / `running` / `outdoor`）。
> 段階2で物理分割する際は、スキーマ単位がそのまま切り出し境界になる。
>
> 命名規則: 「種目別テーブルは `<schema>.<entity>`」。依頼書の `golf_user_profiles` 等の
> プレフィックス命名は、**スキーマ分離する場合は `golf.user_profiles` と等価**。物理分割を
> 想定しスキーマ方式を推奨するが、単一スキーマで運用するなら `golf_*` プレフィックス命名でも可。

---

## 1. account スキーマ（共通ユーザ基盤・PII / 認証の唯一の保有者）

既存 `public.users` / `profiles` / `user_roles` を移設・拡張。

```sql
-- 認証・非公開（他利用者に公開しない: email/phone/本名/生年月日）
account.users (
  id uuid pk references auth.users(id),
  email text, phone text, status user_status,
  email_verified_at, phone_verified_at, identity_verified_at timestamptz,
  last_login_at, created_at, updated_at, deleted_at timestamptz
)

account.user_roles (user_id, role)               -- 既存。admin / facility_owner

-- 共通プロフィール（公開・種目色を持たない）。依頼§プロフィール設計「共通」に対応
account.profiles (
  user_id uuid pk references account.users(id),
  nickname text not null,        -- 既存 display_name を改名
  gender gender, age_range text,  -- birth_year ではなく age_range で粒度を粗く（プライバシー）
  avatar_url text, area text,     -- prefecture/city/activity_area を集約
  introduction text,
  verification_status text,
  rating numeric, participation_count int, organizer_count int, -- 集計値（種目横断の総合）
  created_at, updated_at
)

-- 依頼§共通ユーザ管理の役割を新テーブル化
account.notification_settings (user_id pk, email_enabled bool, push_enabled bool, prefs jsonb)
account.terms_agreements (user_id, terms_version text, agreed_at, pk(user_id, terms_version))
account.verifications (user_id, type, status, evidence_url, reviewed_at, ...)  -- 本人確認
account.billing_customers (user_id pk, stripe_customer_id text)  -- 既存 billing から移設
```

> 既存 `profiles.rating` 等の集計トリガー（`0003_reviews.sql`）は **種目横断の総合評価**として
> `account.profiles` に残す。種目別の評価が必要になったら各種目スキーマに `*_reviews` を追加し、
> 集計先を分ける（段階2）。

---

## 2. core スキーマ（種目横断の共通機能）

種目ごとに分割しない。すべて `account.users(user_id)` を参照。

```sql
core.sports (id, parent_id, category_type, name, slug, icon, display_order, status)
  -- 既存 sports ツリー。どの種目スキーマが存在するかのカタログも兼ねる
  --   例: slug='golf' の行が golf スキーマに対応

core.notifications (id, user_id, type, title, body, link, read_at, created_at)
  -- 全種目の通知を集約。notifyUser() はここに INSERT（サービスロール）

core.reports (id, reporter_id, target_type, target_id, domain text, reason, status, ...)
  -- domain 列で 'golf'/'running'/'facility' 等を区別。横断管理可能に

core.blocks (blocker_id, blocked_id, created_at, pk(blocker_id, blocked_id))
  -- is_blocked_between(a,b) RPC は core に移設

core.audit_logs (id, actor_id, action, target_type, target_id, domain, meta jsonb, created_at)
```

---

## 3. facility スキーマ（種目横断の共有資産）

施設は複数種目で共有するため**種目ごとに複製しない**。既存 `facilities` 系を移設。

```sql
facility.facilities (id, name, facility_type, address, prefecture, city,
                     latitude, longitude, geog geography, ...)   -- PostGIS 維持
facility.facility_sports (facility_id, sport_id)   -- core.sports と多対多 = 種目紐付け
facility.facility_features (facility_id, feature_key, value)
facility.facility_images (facility_id, url, ...)
facility.facility_submissions (id, user_id, facility_id, submitted_data jsonb, status, ...)
  -- submitted_data のキーは facilities のカラム名に一致。例外: sport_ids（uuid[]）は
  -- 一般登録 /facilities/register が付与し、承認時に facility_sports へ展開（facilities へは入れない）。
facility.facility_owners (facility_id, user_id, verified_at)
facility.facility_reviews (id, facility_id, user_id, rating, comment, ...)
```

> `nearby_facilities(lat,lng,radius_m,lim)` RPC（`0006_geo.sql`）は `facility` スキーマへ。
> 各種目イベントは `golf.events.facility_id → facility.facilities.id` を参照する。

---

## 4. 種目スキーマ（独立・疎結合）

各種目は**自分のスキーマ内だけで完結**し、外部参照は `account.users` / `core.sports` /
`facility.facilities` の3つに限定する（これが疎結合の境界）。

### 4.1 golf スキーマ

```sql
-- 種目別プロフィール（依頼§ゴルフ用プロフィール）
golf.user_profiles (
  user_id uuid pk references account.users(id),
  average_score int, handicap numeric,
  preferred_area text, available_days text[],
  club_owned bool, beginner_friendly bool,
  created_at, updated_at
)

-- 仲間募集（既存 recruitments を種目化したもの）= イベント
golf.events (
  id uuid pk,
  organizer_id uuid references account.users(id),
  facility_id uuid references facility.facilities(id),  -- 施設未定なら null
  sport_id uuid references core.sports(id),             -- golf配下の小分類
  title, description, prefecture, city,
  event_start_at, event_end_at, application_deadline timestamptz,
  capacity int, participation_fee int,
  approval_type approval_type, status recruitment_status,
  -- 種目固有: tee_time, course_type, play_style 等
  created_at, updated_at, deleted_at
)

golf.event_participants (event_id, user_id, status participant_status,
                         application_message, attendance_status, applied_at, ...)
golf.reservations (id, event_id, facility_id, user_id, reserved_at, status, ...)
golf.scores (id, event_id, user_id, total_score, hole_scores jsonb, recorded_at)
golf.chat_rooms (id, event_id unique, status)
golf.chat_room_members (chat_room_id, user_id, role, joined_at)
golf.chat_messages (id, chat_room_id, sender_id, body, created_at)
```

### 4.2 running スキーマ（依頼§ランニング例）

```sql
running.user_profiles (user_id pk → account.users, pace text, distance_preference text,
                       race_experience text, preferred_time text)
running.events (id, organizer_id → account.users, course_id, facility_id → facility, ...)
running.courses (id, name, distance_m, area, geog geography, created_by → account.users)
running.event_participants (event_id, user_id → account.users, status, ...)
running.records (id, user_id → account.users, event_id, distance_m, duration_s, recorded_at)
-- chat_* は golf と同型
```

### 4.3 outdoor スキーマ（依頼§アウトドア例）

```sql
outdoor.user_profiles (user_id pk → account.users, activity_type text, experience_level text,
                       gear_owned text[], transportation text, solo_participation_ok bool)
outdoor.spots (id, name, spot_type, area, latitude, longitude, geog geography)
outdoor.events (id, organizer_id → account.users, spot_id, facility_id → facility, ...)
outdoor.event_participants (event_id, user_id → account.users, status, ...)
outdoor.gear (id, user_id → account.users, name, category, note)
-- chat_* は golf と同型
```

> **共通の状態遷移ロジック**（募集状態 draft→open→full→closed、参加 applied→approved→…）は
> 各種目で重複定義せず、`packages/domain-common` の型・遷移関数として共有する。
> テーブル定義は種目ごとに持つが、列名・enum は共通カタログ（`packages/shared-types`）に合わせる。

---

## 5. 種目追加時の拡張ルール（成果物#6）

新種目（例: tennis, cycling）追加の手順。**既存に触れない**のが原則。

```text
[DB]
1. 新スキーマ作成: create schema tennis;
2. core.sports に種目ルート行を追加（slug='tennis'）
3. tennis.user_profiles / events / event_participants / chat_* を golf 雛形から作成
   - 種目固有列のみ差し替える
4. account / core / facility の既存テーブルは一切変更しない（列追加禁止）
5. RLS は golf スキーマのポリシーをコピーして tennis 用に適用

[コード]
6. apps/tennis（段階2）または app/(tennis) ルートグループ（段階1）を golf から複製
7. services/tennis-api（段階2のみ）
8. packages/shared-types に tennis 用ドメイン型を追加（共通遷移は再利用）

[禁止事項]
- account.users / account.profiles に種目固有列を足さない
- 既存種目スキーマのテーブルを共用しない（tennis のデータを golf.events に入れない）
- 認証・ログインを種目側に複製しない（必ず account 経由）
```

**良い例 / 悪い例（依頼§設計上の注意点）**

```text
良い: account.users + golf.user_profiles + tennis.user_profiles
悪い: account.users に golf_handicap, tennis_level, camp_experience を直接追加
```

---

## 6. RLS 方針（スキーマ分離での注意）

- 判定基準は常に `auth.uid() = account.users.id`。種目テーブルの `user_id` はこれと突き合わせる。
- スキーマをまたぐ FK（例: `golf.events.organizer_id → account.users`）の参照可否は、
  種目テーブル側のポリシーで完結させる（account を直接 select させない）。
- 公開プロフィール参照は `account.profiles` のみ許可（`account.users` の email/phone は本人と管理者のみ）。
- 書き込みで他者行に触れる集計・通知は**サービスロール**（`core.notifications` INSERT、評価集計トリガー）を継続。
- admin はサービスロールで全スキーマ横断。操作前に `getAdminUser()` 検証、`core.audit_logs` 記録。

---

## 7. マイグレーション実装メモ（承認後）

```sql
-- 0009_schema_split.sql（破壊的変更を避け、move 中心）
create schema account; create schema core; create schema facility;
create schema golf;    -- running/outdoor は同様

alter table public.users      set schema account;
alter table public.profiles   set schema account;  -- 列リネームは別ステップ
alter table public.sports     set schema core;
alter table public.facilities set schema facility;
-- recruitments → golf.events はデータ振り分けが要るので別マイグレーションで実施
```

既存の `0001`〜`0008` は据え置き、`0009` 以降で段階的に移行する（ロールバック可能な単位で分割）。
```
