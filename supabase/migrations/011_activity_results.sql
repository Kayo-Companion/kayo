-- Add activity_results to calls so the menu-driven Kayo can persist
-- per-call activity outcomes (quiz scores, HDS-R results, shiritori counts).
--
-- Shape: JSONB array of {type, ...} objects. One call may have multiple
-- segments (e.g., the user did chat → quiz → brain_training in one call).
--
-- Element examples:
--   {"type":"conversation"}
--   {"type":"quiz","category":"animals","correct":4,"total":5,"items":[...]}
--   {"type":"shiritori","turn_count":12,"winner":"user"}
--   {"type":"brain_training","total":27,"max":30,"interpretation":"...","questions":[...]}
--
-- Why JSONB rather than a normalized table: activity types evolve fast
-- and the dashboard renders them as cards directly. Splitting into a
-- table now would mean schema churn on every iteration. Switch to a
-- table when we need cross-call aggregation queries (HDS-R trend graphs
-- already work fine via -> 'total' filters on this column).

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS activity_results jsonb;

-- Lightweight index for "did this senior do 脳トレ this month?"-style
-- queries: filter on JSONB array element type.
CREATE INDEX IF NOT EXISTS idx_calls_activity_results
  ON calls USING GIN (activity_results);
