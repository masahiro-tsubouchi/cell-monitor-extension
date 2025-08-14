-- MAP機能拡張: classroom_mapsとteam_positionsテーブル追加

-- 教室MAPテーブル
CREATE TABLE IF NOT EXISTS classroom_maps (
    id SERIAL PRIMARY KEY,
    image_filename VARCHAR(255) NOT NULL,
    image_url TEXT NOT NULL,
    original_filename VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(255), -- 講師ID/メールアドレス
    is_active BOOLEAN DEFAULT true,
    file_size_bytes INTEGER DEFAULT 0,
    content_type VARCHAR(100) DEFAULT 'image/jpeg'
);

-- チーム配置情報テーブル
CREATE TABLE IF NOT EXISTS team_positions (
    id SERIAL PRIMARY KEY,
    map_id INTEGER REFERENCES classroom_maps(id) ON DELETE CASCADE,
    team_name VARCHAR(100) NOT NULL,
    position_x DECIMAL(5,2) NOT NULL CHECK (position_x >= 0 AND position_x <= 100), -- パーセント座標 0-100
    position_y DECIMAL(5,2) NOT NULL CHECK (position_y >= 0 AND position_y <= 100), -- パーセント座標 0-100
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255), -- 更新者ID/メールアドレス
    UNIQUE(map_id, team_name)
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_classroom_maps_active ON classroom_maps(is_active);
CREATE INDEX IF NOT EXISTS idx_classroom_maps_uploaded_at ON classroom_maps(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_positions_map_id ON team_positions(map_id);
CREATE INDEX IF NOT EXISTS idx_team_positions_team_name ON team_positions(team_name);

-- サンプルデータ追加（開発用）
INSERT INTO classroom_maps (
    image_filename,
    image_url,
    original_filename,
    uploaded_by,
    is_active
) VALUES (
    'default_classroom.jpg',
    '/static/maps/default_classroom.jpg',
    'classroom_layout.jpg',
    'system@example.com',
    true
) ON CONFLICT DO NOTHING;

-- デフォルトチーム配置（サンプル）
DO $$
DECLARE
    map_id_var INTEGER;
    team_names TEXT[] := ARRAY['チームA', 'チームB', 'チームC', 'チームD', 'チームE', 'チームF'];
    i INTEGER;
    base_x DECIMAL := 15.0;
    base_y DECIMAL := 20.0;
BEGIN
    SELECT id INTO map_id_var FROM classroom_maps WHERE image_filename = 'default_classroom.jpg' LIMIT 1;

    IF map_id_var IS NOT NULL THEN
        FOR i IN 1..array_length(team_names, 1) LOOP
            INSERT INTO team_positions (
                map_id,
                team_name,
                position_x,
                position_y,
                updated_by
            ) VALUES (
                map_id_var,
                team_names[i],
                base_x + ((i-1) % 3) * 25.0, -- 3列配置
                base_y + ((i-1) / 3) * 30.0, -- 2行配置
                'system@example.com'
            ) ON CONFLICT (map_id, team_name) DO NOTHING;
        END LOOP;
    END IF;
END $$;
