-- FCM 토큰 테이블 생성
CREATE TABLE IF NOT EXISTS face_reader_fcm_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_face_reader_fcm_tokens_user_id ON face_reader_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_face_reader_fcm_tokens_token ON face_reader_fcm_tokens(token);
CREATE INDEX IF NOT EXISTS idx_face_reader_fcm_tokens_platform ON face_reader_fcm_tokens(platform);

-- 업데이트 시간 자동 갱신을 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
DROP TRIGGER IF EXISTS update_face_reader_fcm_tokens_updated_at ON face_reader_fcm_tokens;
CREATE TRIGGER update_face_reader_fcm_tokens_updated_at
    BEFORE UPDATE ON face_reader_fcm_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE face_reader_fcm_tokens IS 'FCM 푸시 알림 토큰 저장 테이블';
COMMENT ON COLUMN face_reader_fcm_tokens.token IS 'FCM 등록 토큰';
COMMENT ON COLUMN face_reader_fcm_tokens.platform IS '플랫폼 (ios, android, web)';
COMMENT ON COLUMN face_reader_fcm_tokens.user_id IS '사용자 ID (로그인한 사용자인 경우)';
