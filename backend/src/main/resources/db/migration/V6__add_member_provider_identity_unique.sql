-- 소셜 로그인 회원은 (provider, provider_id) 로 찾는다(Apple). 같은 쌍의 활성 회원이 둘이면
-- 어느 쪽으로 로그인될지 정해지지 않으므로, 동시에 들어온 두 가입 요청이 둘 다 저장되지 않게 DB 가 막는다.
--
-- 부분 인덱스인 이유:
--   * deleted_at IS NULL — 탈퇴(유예 30일) 회원은 provider_id 를 그대로 남긴다. 그 기간에 같은 Apple/Google
--     계정으로 다시 가입하면 새 행이 같은 쌍을 갖는 것이 정상이다.
--   * provider_id IS NOT NULL — 이메일 가입(LOCAL) 회원은 provider_id 가 없다.
-- 2026-11-28 운영 DB 에서 위 조건의 중복이 0건임을 확인하고 추가했다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_provider_identity_active
    ON member (provider, provider_id)
    WHERE deleted_at IS NULL AND provider_id IS NOT NULL;
