-- 일일 리셋 배치의 진행 기록. "마지막으로 처리한 경계 시각"을 담는다(리셋을 실행한
-- 시각이 아니다). 배치가 '지금 시각 == dailyResetHour' 로 대상을 고르던 시절에는
-- 그 정각에 파드가 안 떠 있으면 그날치 리셋이 통째로 사라졌고, 한 시간 뒤엔 조건이
-- 안 맞아 재시도도 없었다. 이 컬럼이 생기면서 배치는 몇 시에 돌든 밀린 경계를 따라잡는다.
--
-- TIMESTAMPTZ 인 이유: 경계는 절대 시각이고, 회원마다 타임존이 달라 비교가 섞인다.
-- created_at/deleted_at 은 기존 관례를 따라 TIMESTAMP 로 두지만, 이 값은 판정에
-- 직접 쓰이므로 오프셋을 잃으면 안 된다.
ALTER TABLE member ADD COLUMN IF NOT EXISTS last_reset_boundary_at TIMESTAMPTZ;

-- 백필을 now() 로 하는 이유. 이 컬럼이 비어 있으면 배포 직후 첫 실행이 전 회원을
-- "한 번도 리셋한 적 없음"으로 보고 즉시 리셋해, 그 시각까지 오늘 쌓은 시간을 날린다.
-- now() 를 넣으면 아직 안 온 다음 경계부터 정상적으로 잡힌다. 배포 시점이 마침
-- 경계 직후라 그 경계를 놓쳤더라도 잃는 것은 그 한 번뿐이고, 잘못 리셋하는 쪽보다 안전하다.
UPDATE member SET last_reset_boundary_at = now() WHERE last_reset_boundary_at IS NULL;

-- 판정이 null 분기를 타지 않게 한다. 신규 회원은 엔티티가 가입 시각으로 채운다.
ALTER TABLE member ALTER COLUMN last_reset_boundary_at SET DEFAULT now();
ALTER TABLE member ALTER COLUMN last_reset_boundary_at SET NOT NULL;
