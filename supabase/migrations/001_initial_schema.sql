-- Kayo initial schema.
-- Tables: families (subscribers), seniors (end users), calls, alerts.
-- RLS so a family can only see their own seniors / calls / alerts.

-- ============================================================================
-- families
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive',

  -- Subscription tier: light=100min, standard=400min, premium=1000min
  plan TEXT NOT NULL DEFAULT 'standard'
    CHECK (plan IN ('light', 'standard', 'premium')),

  -- Usage metering (resets each billing period; topped up by add-on packs).
  minutes_limit INTEGER NOT NULL DEFAULT 400,
  minutes_used INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS families_user_id_idx ON public.families(user_id);

-- ============================================================================
-- seniors
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seniors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  -- schedule: jsonb array of {weekday, time}, e.g.
  --   [{"weekday":"mon","time":"09:00"}, {"weekday":"sat","time":"14:00"}]
  -- weekday is "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  call_timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  is_self BOOLEAN NOT NULL DEFAULT false,
  introducer_name TEXT,
  introducer_relationship TEXT,
  -- Free-text "話したいこと" / "あの方について" — fed to the system prompt.
  health_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT introducer_required_for_gift CHECK (
    is_self = true
    OR (introducer_name IS NOT NULL AND introducer_relationship IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS seniors_family_id_idx ON public.seniors(family_id);
CREATE INDEX IF NOT EXISTS seniors_phone_active_idx
  ON public.seniors(phone) WHERE is_active = true;

-- ============================================================================
-- calls
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES public.seniors(id) ON DELETE CASCADE NOT NULL,
  twilio_call_sid TEXT UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
    END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'initiated',
  summary TEXT,
  topics_discussed TEXT[],
  mood TEXT,                           -- positive | neutral | negative
  distress_detected BOOLEAN NOT NULL DEFAULT false,
  distress_reason TEXT,
  transcript JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calls_senior_started_idx
  ON public.calls(senior_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calls_distress_idx
  ON public.calls(senior_id) WHERE distress_detected = true;

-- ============================================================================
-- alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES public.seniors(id) ON DELETE CASCADE NOT NULL,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  type TEXT NOT NULL,                  -- distress | health | no_answer | suspicious
  severity TEXT NOT NULL,              -- low | medium | high
  message TEXT NOT NULL,
  notified_family BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_senior_idx ON public.alerts(senior_id, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_unresolved_idx
  ON public.alerts(senior_id) WHERE resolved = false;

-- ============================================================================
-- updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER families_set_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER seniors_set_updated_at
  BEFORE UPDATE ON public.seniors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seniors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts   ENABLE ROW LEVEL SECURITY;

-- families: a user sees and updates only their own row
CREATE POLICY "families select own" ON public.families
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "families insert own" ON public.families
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "families update own" ON public.families
  FOR UPDATE USING (auth.uid() = user_id);

-- seniors: tied to families.user_id
CREATE POLICY "seniors all own" ON public.seniors
  FOR ALL
  USING (
    family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid())
  )
  WITH CHECK (
    family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid())
  );

-- calls: read-only for family; voice service uses service-role key (bypasses RLS)
CREATE POLICY "calls select via senior" ON public.calls
  FOR SELECT USING (
    senior_id IN (
      SELECT s.id FROM public.seniors s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );

-- alerts: read + mark-resolved by family
CREATE POLICY "alerts select via senior" ON public.alerts
  FOR SELECT USING (
    senior_id IN (
      SELECT s.id FROM public.seniors s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );
CREATE POLICY "alerts update resolve" ON public.alerts
  FOR UPDATE USING (
    senior_id IN (
      SELECT s.id FROM public.seniors s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );
