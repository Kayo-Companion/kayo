-- Per-senior list of observation keys the family has dismissed from the
-- 気づき tab. Each key is "<call_id>:<index>" where index is the
-- observation's position in the calls.observations JSONB array.
--
-- The dashboard filters dismissed keys out client-side rather than
-- mutating the underlying observation. Keeping the original observation
-- intact lets us re-display it later if we add a "show dismissed"
-- toggle, and preserves the audit trail for research analysis.
ALTER TABLE public.seniors
  ADD COLUMN IF NOT EXISTS dismissed_observations TEXT[] NOT NULL DEFAULT '{}';
