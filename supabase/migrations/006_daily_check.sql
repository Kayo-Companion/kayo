-- Daily wellness check ("安否確認モード"): if no call (in either direction)
-- has happened with this senior by the given time-of-day, send an SMS to
-- the emergency contact. Stored as "HH:MM" in the senior's call_timezone.
-- NULL means daily-check is disabled (the existing emergency_on_no_answer
-- still applies on a per-call basis).
ALTER TABLE public.seniors
  ADD COLUMN IF NOT EXISTS daily_check_deadline TEXT;
