-- Sign in with Apple 회원의 Apple refresh token 암호문(AES-GCM). 계정 삭제 때 Apple 승인 철회에만 쓴다
-- (App Store 가이드라인 5.1.1(v)). NULL = Apple 회원이 아니거나 아직 교환 전, 또는 이미 철회함.
ALTER TABLE member ADD COLUMN IF NOT EXISTS apple_refresh_token VARCHAR(1024) NULL;
