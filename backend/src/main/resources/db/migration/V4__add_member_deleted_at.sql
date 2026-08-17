-- 계정 삭제를 즉시 물리 삭제가 아니라 '삭제 상태'로 둔다(유예 30일).
-- NULL = 정상 계정. 값이 있으면 삭제 요청 시각이며, 그 순간부터 조회 대상에서 빠진다.
ALTER TABLE member ADD COLUMN deleted_at TIMESTAMP NULL;

-- purge 배치가 매일 "유예가 지난 것"만 훑는다. 대부분의 행은 deleted_at IS NULL 이라
-- 부분 인덱스로 두면 인덱스가 삭제 대기 계정 수만큼만 커진다.
CREATE INDEX idx_member_deleted_at ON member (deleted_at) WHERE deleted_at IS NOT NULL;
