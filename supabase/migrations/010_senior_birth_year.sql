-- Birth year of the senior, captured at signup. Used to:
--
-- 1. Normalize cognitive-function observations and Care Scores (HDS-R /
--    MMSE cutoffs are age-stratified, so "score X at age 70" and "score X
--    at age 90" carry very different signal).
-- 2. Stratify research data when we hand de-identified summaries to
--    academic partners.
-- 3. Tune the prompt's tone (a 65-year-old and an 88-year-old expect
--    different rhythms of conversation).
--
-- Stored as the 4-digit Gregorian year (e.g. 1948). Nullable so older
-- rows that signed up before the field existed don't break — those can
-- be backfilled by asking the family in the dashboard.
ALTER TABLE public.seniors
  ADD COLUMN IF NOT EXISTS birth_year INTEGER
    CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2010));
