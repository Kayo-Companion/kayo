-- Custom AI-agent name per senior. Null means "use the product default
-- (カヨ)". Lets buyers personalize the assistant's name without forking
-- prompts per-senior on the voice service side.
ALTER TABLE public.seniors
  ADD COLUMN IF NOT EXISTS agent_name TEXT;
