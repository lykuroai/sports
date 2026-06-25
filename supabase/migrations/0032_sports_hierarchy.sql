-- =============================================================
-- 0032 種目の大分類/小分類 階層（募集の種目選択を 大分類→小分類 にするため）
-- 根拠: spotomo_sport_category_page_design §3/§14、依頼（募集データに種目: 大分類と小分類）
--
-- core.sports は parent_id(自己参照) を持つが seed は全てフラット（parent_id=null）。
-- 大分類(親)を追加し、既存の種目を小分類(子)として parent_id でぶら下げる。
-- 既存 id は変更しないため facility_sports / running.events.sport_id 等の参照は不変。
-- =============================================================

-- 大分類（親。parent_id=null）。slug は既存(小分類)と衝突しないよう cat- 接頭辞。
insert into core.sports (parent_id, category_type, name, slug, display_order) values
  (null, 'sports',  'ゴルフ',               'cat-golf',    10),
  (null, 'sports',  'ランニング・マラソン', 'cat-running', 20),
  (null, 'sports',  '球技',                 'cat-ball',    30),
  (null, 'sports',  'フィットネス',         'cat-fitness', 40),
  (null, 'sports',  '武道・格闘技',         'cat-martial', 50),
  (null, 'sports',  '水泳・水辺',           'cat-water',   60),
  (null, 'outdoor', 'ウィンタースポーツ',   'cat-winter',  70),
  (null, 'sports',  'サイクリング',         'cat-cycling', 80),
  (null, 'outdoor', 'アウトドア',           'cat-outdoor', 90),
  (null, 'sports',  'レジャー',             'cat-leisure', 100),
  (null, 'sports',  'その他',               'cat-other',   110)
on conflict (slug) do nothing;

-- 小分類が不足するもの（ランニング系）を追加。
insert into core.sports (parent_id, category_type, name, slug, display_order) values
  ((select id from core.sports where slug = 'cat-running'), 'sports', '駅伝',     'ekiden',    25),
  ((select id from core.sports where slug = 'cat-running'), 'sports', '陸上競技', 'athletics', 26)
on conflict (slug) do nothing;

-- 既存の種目を大分類へぶら下げる（parent_id を設定）。
update core.sports set parent_id = (select id from core.sports where slug = 'cat-golf')
  where slug in ('golf');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-running')
  where slug in ('running', 'jogging', 'marathon', 'walking', 'ekiden', 'athletics');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-ball')
  where slug in ('tennis', 'table-tennis', 'badminton', 'soccer', 'futsal', 'baseball', 'softball', 'basketball', 'volleyball');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-fitness')
  where slug in ('yoga', 'fitness', 'strength', 'dance');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-martial')
  where slug in ('martial-arts');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-water')
  where slug in ('swimming', 'surfing', 'diving', 'snorkeling', 'canoe', 'kayak', 'rafting', 'sea-bathing');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-winter')
  where slug in ('ski', 'snowboard');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-cycling')
  where slug in ('cycling', 'touring');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-outdoor')
  where slug in ('mountaineering', 'hiking', 'trekking', 'camping', 'glamping', 'bbq', 'picnic',
                 'fishing', 'park-walk', 'stargazing', 'nature-watch', 'outdoor-photo', 'drive', 'other-outdoor');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-leisure')
  where slug in ('bowling', 'billiards', 'darts');
update core.sports set parent_id = (select id from core.sports where slug = 'cat-other')
  where slug in ('spectating', 'motorsports', 'other-sports');
