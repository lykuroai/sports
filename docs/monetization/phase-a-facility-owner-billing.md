# Phase A 詳細設計 — 施設運営者向け有料プラン（Stripe Billing）

> **【廃止 / DEPRECATED — 2026-06-22】** 方針変更により施設運営者は**無料**となり、Phase A の
> サブスク課金は廃止した（アプリ課金導線・DB テーブルを削除、`0025_drop_facility_billing.sql`）。
> 本ドキュメントは履歴として残す。現行の方針は `docs/changelog/2026-06-22-spec-changes.md` を参照。

> 収益ロードマップ Phase A。確認済み施設運営者（`facility_owners`）への月額サブスク
> 課金で、上位表示・複数画像・リード分析などの機能を解放する。
> **Connect（Phase C/D）前提**で構造を組むが、A 自体は Billing のみで完結し決済の
> マーケットプレイス処理は含めない。一般利用者の無料体験は一切変更しない。

## 0. 方針サマリ

- 課金主体は **施設運営者（user）= Stripe Customer**。商品は **施設単位の昇格枠**。
- 決済 UI は **Stripe Checkout（`mode: 'subscription'`）**、解約・支払方法変更は
  **Customer Portal**。自前の決済フォームは作らない（PCI 範囲を持たない）。
- Stripe → DB の同期は **Webhook を唯一の真実源**にする。Checkout 完了直後の画面表示は
  楽観的に扱い、権限（昇格）の確定は Webhook が `facilities.promotion_rank` /
  `promoted_until` を更新したときのみ。
- 機能ゲートは**読み取り時に Stripe を呼ばない**。検索・詳細は `facilities` の
  非正規化カラム（`promotion_rank` / `promoted_until`）と `facility_subscriptions.status`
  だけで判定する。
- プラン定義はハードコードせず **`subscription_plans` テーブル + 管理画面**で管理
  （仕様 §15.10）。Stripe 側の Price とは `stripe_price_id` で対応づける。

### Connect 前提のための構造的配慮（A で作るが C/D で再利用）

| 仕組み | A での役割 | C/D での再利用 |
|---|---|---|
| `src/lib/stripe/client.ts`（単一の Stripe 初期化、RAK 使用） | Billing 呼び出し | Connect / PaymentIntent でも同じクライアント |
| `stripe_events`（イベント冪等化テーブル） | サブスク Webhook の重複排除 | `account.updated` / `payment_intent.*` も同じ表で冪等化 |
| `/api/stripe/webhook` の **switch 型ハンドラ** | サブスク系イベントのみ処理 | Connect イベントを case 追加するだけ |
| `billing_customers`（user ↔ stripe_customer_id） | 運営者の Customer 対応 | Phase B のプレミアム会員もこの表を共用 |
| `connected_accounts`（**A では作らないが命名予約**） | — | Phase C で organizer の連結アカウントを保持 |

## 1. データモデル（マイグレーション `0008_billing.sql`）

```sql
-- 1.1 プラン定義（管理画面から編集可能。§15.10）
create table public.subscription_plans (
  id              uuid primary key default uuid_generate_v4(),
  code            text not null unique,          -- 例: 'facility_basic'
  name            text not null,
  description     text,
  stripe_price_id text,                           -- Stripe Dashboard で作成した Price
  amount          int  not null default 0,        -- 表示用（円）。課金額の真実源は Stripe
  interval        text not null default 'month',  -- 'month' | 'year'（表示用）
  entitlements    jsonb not null default '{}',    -- 例: {"promotion_rank":10,"max_images":10,"analytics":true}
  is_active       boolean not null default true,
  display_order   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 1.2 user ↔ Stripe Customer（Phase B でも共用）
create table public.billing_customers (
  user_id            uuid primary key references public.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

-- 1.3 施設単位のサブスク（真実源は Stripe、ここは投影）
create table public.facility_subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  facility_id            uuid not null references public.facilities (id) on delete cascade,
  owner_user_id          uuid not null references public.users (id) on delete cascade,
  plan_id                uuid references public.subscription_plans (id),
  stripe_subscription_id text unique,
  status                 text not null default 'incomplete',
    -- Stripe の subscription.status をそのまま保持:
    -- incomplete | trialing | active | past_due | canceled | unpaid
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (facility_id)   -- 1 施設につき有効サブスクは 1 本
);
create index facility_subscriptions_status_idx
  on public.facility_subscriptions (status);

-- 1.4 Webhook 冪等化（Connect でも共用）
create table public.stripe_events (
  id            text primary key,    -- Stripe event.id（evt_...）
  type          text not null,
  received_at   timestamptz not null default now()
);

-- 1.5 facilities への非正規化カラム（読み取り高速化・検索並び替え用）
alter table public.facilities
  add column promotion_rank int not null default 0,        -- 高いほど上位
  add column promoted_until timestamptz;                   -- これを過ぎたら昇格失効
create index facilities_promotion_idx
  on public.facilities (promotion_rank desc, promoted_until);
```

**設計判断**
- `facility_subscriptions.status` は Stripe の `subscription.status` 文字列をそのまま投影
  （独自 enum を作らない＝Stripe 仕様変更に追従しやすい）。
- 昇格の有効判定は `status in ('active','trialing') and promoted_until > now()`。
  ただし検索クエリでは `facilities.promotion_rank`（Webhook が反映）だけ見れば済むよう
  非正規化する。`promoted_until` で期限切れを SQL 側でも二重に担保。
- `unique(facility_id)` で「1 施設 = 有効サブスク 1 本」。再購読は同レコードを更新。

## 2. RLS（マイグレーション末尾 / `0002_rls.sql` 流儀に合わせる）

- `subscription_plans`: **`is_active = true` は全員 select 可**（料金ページ表示）。
  insert/update/delete は無し → 管理操作はサービスロールで実行。
- `billing_customers`: 本人のみ select（`user_id = auth.uid()`）。書き込みポリシー無し
  → 作成は Server Action 内でサービスロール。
- `facility_subscriptions`: **施設の承認済みオーナーのみ select**
  （`exists (select 1 from facility_owners fo where fo.facility_id = facility_subscriptions.facility_id and fo.user_id = auth.uid() and fo.status = 'verified')`）。
  書き込みポリシー無し → Webhook / Server Action がサービスロールで実行。
- `stripe_events`: ポリシー無し（サービスロール専用）。
- `facilities` の新カラムは既存ポリシーのまま（公開読み取り）。書き込みはサービスロール。
  ただし既存の `facilities_owner_update`（verified オーナーが自施設行を update 可）は
  カラム単位の制限が無いため、**`promotion_rank` / `promoted_until` への UPDATE 権限を
  `anon`/`authenticated` から REVOKE** し、オーナーによる自己昇格を防ぐ
  （`0008_billing.sql` 末尾）。サービスロールは権限をバイパスするので Webhook は通る。

> 既存の `notifications` / 管理操作と同じく「他者・特権データの書き込みはサービスロール、
> 読み取りのみ RLS」という本リポジトリの原則を踏襲（CLAUDE.md）。

## 3. Stripe 連携レイヤ

### 3.1 ファイル構成

```
src/lib/stripe/
  client.ts        # Stripe SDK 初期化（STRIPE_SECRET_KEY=制限付きキー RAK）
  billing.ts       # createCheckoutSession / createPortalSession / ensureCustomer
src/app/api/stripe/webhook/route.ts   # 署名検証 + switch ハンドラ（冪等化）
src/app/facilities/[id]/billing/      # オーナー向け購読導線（料金 → Checkout 遷移）
  page.tsx
  actions.ts       # Server Actions: startCheckout / openPortal
src/app/admin/plans/                  # プラン CRUD（既存 admin と同じガード）
  page.tsx
  actions.ts
```

### 3.2 Checkout（Server Action）

```ts
// 概略。詳細は実装時に確定。
const stripe = getStripe(); // RAK
const customerId = await ensureCustomer(ownerUserId); // billing_customers 参照/作成
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  // payment_method_types は絶対に指定しない（動的決済手段）
  customer: customerId,
  line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
  client_reference_id: facilityId,
  subscription_data: {
    metadata: { facility_id: facilityId, plan_id: plan.id, owner_user_id: ownerUserId },
  },
  success_url: `${SITE}/facilities/${facilityId}/billing?status=success`,
  cancel_url: `${SITE}/facilities/${facilityId}/billing?status=cancel`,
});
redirect(session.url!);
```

### 3.3 Customer Portal（解約・支払方法変更）

`stripe.billingPortal.sessions.create({ customer, return_url })` を Server Action で発行し
リダイレクト。解約・プラン変更・カード更新は **すべて Portal に委譲**（自前 UI を作らない）。

### 3.4 Webhook（真実源・冪等）

`/api/stripe/webhook`:
1. **raw body** を取得（Next.js Route Handler で `await req.text()`。body parser を通さない）。
2. `stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET)` で**署名検証**。
3. `stripe_events` に `event.id` を insert（衝突=処理済みなら 200 で即 return＝冪等）。
4. サービスロールクライアントで分岐処理：

| event.type | 処理 |
|---|---|
| `checkout.session.completed` | `subscription` を取得し `facility_subscriptions` を upsert（facility_id は metadata） |
| `customer.subscription.created/updated` | `status` / `current_period_end` / `cancel_at_period_end` を同期。`active`/`trialing` なら `facilities.promotion_rank`=plan.entitlements.promotion_rank, `promoted_until`=current_period_end を反映 |
| `customer.subscription.deleted` | `status='canceled'`、`facilities.promotion_rank=0` / `promoted_until=null` に戻す |
| `invoice.payment_failed` | `status='past_due'`（昇格は `promoted_until` まで猶予、Portal 督促は Stripe 任せ）。`notifyUser()` でオーナーに通知 |
| `invoice.paid` | 必要なら `current_period_end` 更新（subscription.updated でも届く） |

> **重要**: 昇格カラム（`facilities.promotion_rank`）の更新は Webhook だけが行う。
> Server Action や画面側で先に書かない（Stripe が確定する前に権限を与えない）。

## 4. 機能ゲート（entitlements の適用箇所）

`subscription_plans.entitlements`(jsonb) を施設の有効プランから引いて適用：

- **上位表示**: 施設一覧/地域検索の `order by` に `promotion_rank desc` を先頭追加
  （`src/app/facilities/page.tsx` のクエリ）。`nearby_facilities` RPC は距離優先のまま、
  必要なら同率内で rank を tiebreak に。詳細ページに「PR」バッジ。
- **複数画像**: `facility_images` の登録上限を `entitlements.max_images` で判定
  （無料はデフォルト上限、有料は拡張）。アップロード Server Action でチェック。
- **リード分析**: `recruitments.facility_id = :id` の件数・期間集計を
  オーナー向けダッシュボードに表示（「過去 N 日でこの施設が会場候補にされた募集数」）。
  集計は通常のセッションクライアント（オーナーは自施設を読める RLS で可）。

判定ヘルパ: `getFacilityEntitlements(facilityId)` を `src/lib/billing.ts` に置き、
`facility_subscriptions`（active/trialing かつ未失効）→ `subscription_plans.entitlements`
を返す。無料時は既定 entitlements を返す。

## 5. 権限・ガード

- 購読 Server Action は **承認済みオーナーのみ**:
  `requireFacilityOwner(facilityId)` を `src/lib/auth.ts` に追加
  （`facility_owners` で `user_id=auth.uid()` かつ `status='verified'` を確認、
  既存 `requireAdmin` と同じ流儀）。
- プラン管理画面（`/admin/plans`）は `requireAdmin()`。書き込みはサービスロール +
  `writeAuditLog(actor, 'plan.update', 'subscription_plan', id, {...})`。
- Stripe 鍵は **制限付き API キー（RAK, `rk_`）** をサーバー環境変数で保持。
  クライアントには一切露出しない（Checkout/Portal はサーバーで session を作り URL へ
  リダイレクトするだけなので publishable key も不要）。

## 6. 環境変数（追加）

```
STRIPE_SECRET_KEY=rk_...        # 制限付きキー（最小権限: Checkout/Customer/Subscription/Webhook 読み）
STRIPE_WEBHOOK_SECRET=whsec_... # CLI/Dashboard の signing secret
# NEXT_PUBLIC_SITE_URL は既存を流用（success/cancel/return URL）
```

`.env.example` にも追記。鍵はリポジトリにコミットしない（pre-commit で `sk_`/`rk_` 検知を推奨）。

## 7. 依存追加

```
npm i stripe        # サーバー専用。最新 API バージョン（2026-05-27.dahlia）を明示
```

## 8. 実装タスク順序

1. `0008_billing.sql`（テーブル + RLS + facilities カラム）を作成・適用。
2. `src/lib/stripe/client.ts` + `billing.ts`、`src/lib/billing.ts`（entitlements）。
3. `requireFacilityOwner` を `auth.ts` に追加、`database.types.ts` に新テーブル型を追加。
4. `/api/stripe/webhook`（署名検証 + 冪等 + 同期）。`stripe listen` でローカル検証。
5. オーナー購読導線 `/facilities/[id]/billing`（料金表示 → Checkout → Portal）。
6. 機能ゲート適用（一覧並び替え・画像上限・リード分析ダッシュボード）。
7. 管理プラン CRUD `/admin/plans`（+ 監査ログ）。Stripe Price は Dashboard 作成 → `stripe_price_id` 登録。
8. E2E 手動確認（test カード、`stripe trigger`）。

## 9. 検証チェックリスト

- [ ] Webhook 署名検証が無いイベントを拒否する。
- [ ] 同一 `event.id` を二度受けても二重反映しない（`stripe_events`）。
- [ ] 解約後 `promotion_rank` が 0 に戻り、検索順・PR バッジから消える。
- [ ] `past_due` でも `promoted_until` までは昇格維持、過ぎたら失効。
- [ ] 非オーナーが購読 Action を叩くと拒否される。
- [ ] 無料施設の画像上限・有料施設の拡張上限が正しく効く。
- [ ] Stripe 鍵がクライアントバンドル・ログに出ない。

## 10. Phase C/D への接続メモ

- `recruitments.participation_fee` / `payment_method` は既存。Phase C のイベント集金は
  この既存カラム + `recruitment_participants` に payment 列追加で接続。
- `connected_accounts`（organizer ↔ Stripe connected account）を C で追加。Connect は
  **Standard アカウント + Stripe ホスト型オンボーディング**を既定（プラットフォーム
  賠償責任を最小化、PII を自前保持しない）。Express/Custom は要件が出たときのみ。
- Webhook ハンドラ・`stripe_events`・`stripe/client.ts` をそのまま流用し、
  `account.updated` / `payment_intent.*` / `charge.refunded` の case を追加するだけにする。
</content>
</invoke>
