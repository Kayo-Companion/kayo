-- Per-senior long-term memory: durable facts the agent should remember
-- across calls (likes baseball, has 3 grandchildren, wife is カヨコ, etc.).
--
-- Stored as a JSONB array of strings. Each post-call summarizer adds new
-- facts and dedupes against existing ones. Renders into the system prompt
-- under "# {name}さんについて知っていること" — distinct from short-term
-- recent-call summaries.
ALTER TABLE public.seniors
  ADD COLUMN IF NOT EXISTS long_term_facts JSONB NOT NULL DEFAULT '[]'::jsonb;
