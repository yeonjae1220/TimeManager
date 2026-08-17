-- 계정 삭제를 즉시 물리 삭제가 아니라 '삭제 상태'로 둔다(유예 30일).
-- NULL = 정상 계정. 값이 있으면 삭제 요청 시각이며, 그 순간부터 조회 대상에서 빠진다.
-- IF NOT EXISTS: V1~V3 과 같은 관례. 마이그레이션이 중간에 실패한 뒤 재시도해도
-- 첫 문장에서 막히지 않게 한다.
ALTER TABLE member ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- purge 배치가 매일 "유예가 지난 것"만 훑는다. 대부분의 행은 deleted_at IS NULL 이라
-- 부분 인덱스로 두면 인덱스가 삭제 대기 계정 수만큼만 커진다.
CREATE INDEX IF NOT EXISTS idx_member_deleted_at ON member (deleted_at) WHERE deleted_at IS NOT NULL;
