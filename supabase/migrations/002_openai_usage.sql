-- Track OpenAI Realtime token usage + estimated USD cost per call.
-- usage shape (JSONB):
--   {
--     "input_audio":         <int>,  -- fresh (uncached) audio input tokens
--     "input_audio_cached":  <int>,
--     "input_text":          <int>,  -- fresh text input tokens
--     "input_text_cached":   <int>,
--     "output_audio":        <int>,
--     "output_text":         <int>
--   }
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS openai_usage JSONB,
  ADD COLUMN IF NOT EXISTS openai_cost_usd NUMERIC(10, 6);
