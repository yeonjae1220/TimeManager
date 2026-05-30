-- admin 패널을 위한 멤버 가입일 컬럼 추가
ALTER TABLE member ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL;
