-- Supabase データベース構築用 SQLスクリプト
-- このSQLをSupabaseダッシュボードの「SQL Editor」に貼り付けて実行してください。

-- 1. users テーブル
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  password TEXT DEFAULT '1234'
);

-- 初期データの投入
INSERT INTO users (id, name, is_admin, password) VALUES
  ('u_admin', 'マスター管理者', true, '1234'),
  ('u_A', 'Aさん', true, '1234'),
  ('u_B', 'Bさん', false, '1234'),
  ('u_C', 'Cさん', false, '1234'),
  ('u_D', 'Dさん', false, '1234'),
  ('u_H', 'Hさん', false, '1234'),
  ('u_J', 'Jさん', false, '1234'),
  ('u_K', 'Kさん', false, '1234');

-- 2. pairings テーブル
CREATE TABLE pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  frequency TEXT DEFAULT 'monthly_1'
);

-- 3. questions テーブル
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

-- 初期データの投入
INSERT INTO questions (content, order_index) VALUES
  ('今回の1on1で一番話したいトピックは何ですか？', 1),
  ('最近の業務で困っていることやブロックになっていることはありますか？', 2);

-- 4. sessions テーブル (現在進行中の1on1)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
  date TEXT DEFAULT '未定',
  time TEXT DEFAULT '-',
  status TEXT DEFAULT 'pending', -- pending, ready
  answers JSONB DEFAULT '[]'::jsonb,
  member_memo TEXT DEFAULT '',
  manager_memo TEXT DEFAULT ''
);

-- 5. history テーブル (完了した1on1)
CREATE TABLE history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
  manager_id TEXT,
  member_id TEXT,
  date TEXT,
  time TEXT DEFAULT '完了',
  qa JSONB DEFAULT '[]'::jsonb,
  member_memo TEXT DEFAULT '',
  manager_memo TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. settings テーブル (全体設定用、現在は管理者パスワードを保存)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 初期パスワード「123」を設定
INSERT INTO settings (key, value) VALUES ('admin_password', '123');

-- セキュリティポリシー (RLS) を一時的に無効化（もしくは全て許可）してパブリックアクセスを可能にする
-- ※今回は簡易的なプロトタイプのためパブリックアクセスを許可します
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public all access to users" ON users FOR ALL USING (true);
CREATE POLICY "Allow public all access to pairings" ON pairings FOR ALL USING (true);
CREATE POLICY "Allow public all access to questions" ON questions FOR ALL USING (true);
CREATE POLICY "Allow public all access to sessions" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow public all access to history" ON history FOR ALL USING (true);
CREATE POLICY "Allow public all access to settings" ON settings FOR ALL USING (true);
