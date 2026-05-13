-- Per-call observations for the family dashboard's "気になる変化" card.
--
-- Stored as a JSONB array on the call row. Each entry is shaped:
--   {
--     "type": "forgot_past_fact" | "repeated_story" | "temporal_confusion"
--           | "word_finding" | "engagement_low" | "engagement_high"
--           | "new_topic" | "positive_note",
--     "detail": "先週の運動会の話を、今日は覚えていない様子でした。",
--     "severity": "low" | "medium" | "high",
--     "evidence": "短い引用または該当箇所の要約"
--   }
--
-- A separate `positive` flag distinguishes "気になる" from "良い変化".
-- Used by the dashboard to render observations and (later) to seed
-- research analysis.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS observations JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Twilio call recording URL (or, after eventual mirroring, Supabase Storage
-- URL). Populated by the recording-status webhook once Twilio has finished
-- assembling the recording. Null for calls where recording was disabled or
-- where the recording hasn't been processed yet.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS audio_recording_url TEXT;

-- Buyer consent tracking.
--
-- terms_accepted_at:    when the family checked the (required) terms box.
-- research_consent:     whether the buyer agreed to anonymized data being
--                       used for future research (optional opt-in).
-- research_consent_at:  timestamp of the most recent change to the consent
--                       flag (granted or withdrawn).
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS research_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS research_consent_at TIMESTAMPTZ;
