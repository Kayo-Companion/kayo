-- Per-senior emergency-contact settings.
--
-- emergency_contact_phone:    where to send the SMS (E.164, e.g. "+8190...")
-- emergency_on_no_answer:     if true, send SMS when an outbound Kayo call
--                             ends with status no-answer / busy / failed.
--
-- Distress detection during the call is handled separately in the voice
-- bridge (safety.py + alerts table) and is not gated by these flags.
ALTER TABLE public.seniors
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_on_no_answer BOOLEAN NOT NULL DEFAULT false;
