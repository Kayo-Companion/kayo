-- Add per-senior opt-in for the post-call distress notification.
--
-- When true and the post-call GPT summarizer flags `distress_detected`,
-- an SMS is sent to the senior's emergency_contact_phone with a brief
-- pointer to the dashboard. This is the third trigger in 安否確認モード:
--
--   1. emergency_on_no_answer       — Kayo's call goes unanswered
--   2. daily_check_deadline         — no call by configured time
--   3. emergency_on_distress (new)  — GPT flags a worrying utterance
--
-- Default false so existing seniors don't start receiving SMS unexpectedly.
ALTER TABLE public.seniors
  ADD COLUMN IF NOT EXISTS emergency_on_distress BOOLEAN NOT NULL DEFAULT false;
