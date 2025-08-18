-- compatibility_shares 테이블에 interest 필드 추가
ALTER TABLE compatibility_shares 
ADD COLUMN IF NOT EXISTS interest BOOLEAN DEFAULT NULL;

-- interest 필드에 대한 설명 추가
COMMENT ON COLUMN compatibility_shares.interest IS '사용자의 관심도 응답 (true: 관심있음, false: 관심없음, NULL: 응답 없음)';

-- interest 필드에 대한 인덱스 추가 (선택사항)
CREATE INDEX IF NOT EXISTS idx_compatibility_shares_interest ON compatibility_shares(interest);
