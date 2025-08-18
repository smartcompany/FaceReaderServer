-- 궁합 결과 공유를 위한 테이블 생성
CREATE TABLE IF NOT EXISTS compatibility_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 보내는 사람 정보
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    
    -- 받는 사람 정보
    partner_id TEXT, -- 선택사항 (앱 사용자인 경우)
    partner_name TEXT NOT NULL,
    partner_age TEXT,
    partner_location TEXT,
    partner_gender TEXT,
    
    -- 궁합 분석 결과
    compatibility_result JSONB NOT NULL,
    images JSONB,
    timestamp TEXT,
    
    -- 공유 관련 정보
    share_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 조회 상태
    is_viewed BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    
    -- 메타데이터
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_compatibility_shares_share_code ON compatibility_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_compatibility_shares_sender_id ON compatibility_shares(sender_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_shares_partner_id ON compatibility_shares(partner_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_shares_created_at ON compatibility_shares(created_at);

-- RLS (Row Level Security) 활성화
ALTER TABLE compatibility_shares ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책 (공유 코드로 접근 가능)
CREATE POLICY "Public read access for shared compatibility results" ON compatibility_shares
    FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 가능
CREATE POLICY "Authenticated users can insert compatibility shares" ON compatibility_shares
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 사용자 자신의 공유만 수정 가능
CREATE POLICY "Users can update their own compatibility shares" ON compatibility_shares
    FOR UPDATE USING (auth.uid()::text = sender_id);

-- 사용자 자신의 공유만 삭제 가능
CREATE POLICY "Users can delete their own compatibility shares" ON compatibility_shares
    FOR DELETE USING (auth.uid()::text = sender_id);

-- updated_at 자동 업데이트를 위한 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_compatibility_shares_updated_at 
    BEFORE UPDATE ON compatibility_shares 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명
COMMENT ON TABLE compatibility_shares IS '궁합 분석 결과를 사용자 간에 공유하기 위한 테이블';
COMMENT ON COLUMN compatibility_shares.sender_id IS '궁합 결과를 공유하는 사용자의 ID';
COMMENT ON COLUMN compatibility_shares.sender_name IS '궁합 결과를 공유하는 사용자의 이름';
COMMENT ON COLUMN compatibility_shares.partner_id IS '궁합 결과를 받는 사용자의 ID (앱 사용자인 경우)';
COMMENT ON COLUMN compatibility_shares.partner_name IS '궁합 결과를 받는 사용자의 이름';
COMMENT ON COLUMN compatibility_shares.compatibility_result IS '궁합 분석 결과 JSON';
COMMENT ON COLUMN compatibility_shares.share_code IS '공유를 위한 고유 코드';
COMMENT ON COLUMN compatibility_shares.is_viewed IS '받는 사람이 결과를 확인했는지 여부';
