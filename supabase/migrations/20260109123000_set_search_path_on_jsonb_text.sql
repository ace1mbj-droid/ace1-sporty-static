-- Migration: Set explicit search_path for public._jsonb_text
-- Fixes: function_search_path_mutable warning from security linter

CREATE OR REPLACE FUNCTION public._jsonb_text(j jsonb, key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(TRIM(BOTH FROM (j ->> key)), '');
$$;

COMMENT ON FUNCTION public._jsonb_text(jsonb, text) IS 'Normalized jsonb->>text extractor with explicit search_path';
