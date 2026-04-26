-- 태그 순서 고정을 위한 display_order 컬럼 추가
-- ddl-auto: validate 환경에서 운영 DB에 직접 실행 필요

ALTER TABLE tag ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

-- 기존 태그들의 초기 순서를 tag_id 기준으로 설정 (같은 부모 내에서 생성 순서 유지)
WITH ranked AS (
  SELECT tag_id,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(parent_id, -1) ORDER BY tag_id) - 1 AS rn
  FROM tag
)
UPDATE tag
SET display_order = ranked.rn
FROM ranked
WHERE tag.tag_id = ranked.tag_id;
