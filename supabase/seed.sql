-- =============================================================
-- スポーツ・レジャーカテゴリー seed （仕様 §5）
-- カテゴリーは管理画面から追加・変更・並び替え・公開停止が可能。
-- =============================================================

insert into core.sports (category_type, name, slug, display_order) values
  -- 5.1 スポーツ・レジャー
  ('sports', 'ゴルフ',           'golf',          10),
  ('sports', 'テニス',           'tennis',        20),
  ('sports', '卓球',             'table-tennis',  30),
  ('sports', 'バドミントン',     'badminton',     40),
  ('sports', 'サッカー',         'soccer',        50),
  ('sports', 'フットサル',       'futsal',        60),
  ('sports', '野球',             'baseball',      70),
  ('sports', 'ソフトボール',     'softball',      80),
  ('sports', 'バスケットボール', 'basketball',    90),
  ('sports', 'バレーボール',     'volleyball',   100),
  ('sports', 'ランニング',       'running',      110),
  ('sports', 'ジョギング',       'jogging',      120),
  ('sports', 'マラソン',         'marathon',     130),
  ('sports', 'ウォーキング',     'walking',      140),
  ('sports', 'サイクリング',     'cycling',      150),
  ('sports', '水泳',             'swimming',     160),
  ('sports', 'ヨガ',             'yoga',         170),
  ('sports', 'フィットネス',     'fitness',      180),
  ('sports', '筋力トレーニング', 'strength',     190),
  ('sports', 'ボウリング',       'bowling',      200),
  ('sports', 'ビリヤード',       'billiards',    210),
  ('sports', 'ダーツ',           'darts',        220),
  ('sports', '格闘技',           'martial-arts', 230),
  ('sports', 'ダンス',           'dance',        240),
  ('sports', 'スポーツ観戦',     'spectating',   250),
  ('sports', 'モータースポーツ', 'motorsports',  260),
  ('sports', 'その他のスポーツ', 'other-sports', 270),
  -- 5.2 アウトドア・レジャー
  ('outdoor', '登山',               'mountaineering', 10),
  ('outdoor', 'ハイキング',         'hiking',         20),
  ('outdoor', 'トレッキング',       'trekking',       30),
  ('outdoor', 'キャンプ',           'camping',        40),
  ('outdoor', 'グランピング',       'glamping',       50),
  ('outdoor', 'バーベキュー',       'bbq',            60),
  ('outdoor', 'ピクニック',         'picnic',         70),
  ('outdoor', '釣り',               'fishing',        80),
  ('outdoor', '海水浴',             'sea-bathing',    90),
  ('outdoor', 'サーフィン',         'surfing',       100),
  ('outdoor', 'ダイビング',         'diving',        110),
  ('outdoor', 'シュノーケリング',   'snorkeling',    120),
  ('outdoor', 'カヌー',             'canoe',         130),
  ('outdoor', 'カヤック',           'kayak',         140),
  ('outdoor', 'ラフティング',       'rafting',       150),
  ('outdoor', 'スキー',             'ski',           160),
  ('outdoor', 'スノーボード',       'snowboard',     170),
  ('outdoor', 'ツーリング',         'touring',       180),
  ('outdoor', 'ドライブ',           'drive',         190),
  ('outdoor', '公園散策',           'park-walk',     200),
  ('outdoor', '星空観賞',           'stargazing',    210),
  ('outdoor', '自然観察',           'nature-watch',  220),
  ('outdoor', 'アウトドア写真撮影', 'outdoor-photo', 230),
  ('outdoor', 'その他のアウトドア', 'other-outdoor', 240)
on conflict (slug) do nothing;

-- 施設運営者プラン（収益化 Phase A）。stripe_price_id は環境ごとに後から設定。
insert into facility.subscription_plans (code, name, description, amount, billing_interval, entitlements, display_order) values
  ('basic', 'ベーシック', '検索上位表示・画像枠拡張', 3000, 'month',
   '{"promotion_rank": 1, "max_images": 10, "analytics": false}'::jsonb, 10),
  ('pro', 'プロ', '上位表示強化・リード分析', 8000, 'month',
   '{"promotion_rank": 3, "max_images": 30, "analytics": true}'::jsonb, 20)
on conflict (code) do nothing;
