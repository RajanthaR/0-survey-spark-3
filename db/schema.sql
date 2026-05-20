-- ─────────────────────────────────────────────────────────────────────────────
-- EIP Survey · Portable PostgreSQL schema
-- Vendor-agnostic. Runs on any Postgres 14+. Supabase-friendly (uncomment the
-- auth.uid() policies at the bottom to enforce row-level security there).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_bytes / gen_random_uuid

-- ─── Roles ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  role        public.app_role NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security-definer helper used by RLS policies (avoids recursive RLS lookups).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ─── Responses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_slug   text NOT NULL,
  resume_token  text NOT NULL UNIQUE
                  DEFAULT encode(gen_random_bytes(18), 'base64'),
  language      text NOT NULL DEFAULT 'en',
  status        text NOT NULL DEFAULT 'in_progress'
                  CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  consent       jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact       jsonb,
  progress_pct  integer NOT NULL DEFAULT 0
                  CHECK (progress_pct BETWEEN 0 AND 100),
  user_agent    text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_responses_survey      ON public.responses (survey_slug);
CREATE INDEX IF NOT EXISTS idx_responses_status      ON public.responses (status);
CREATE INDEX IF NOT EXISTS idx_responses_started_at  ON public.responses (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_resume      ON public.responses (resume_token);
CREATE INDEX IF NOT EXISTS idx_responses_stats_filter
  ON public.responses (survey_slug, language, status, started_at);

CREATE OR REPLACE VIEW public.survey_stats AS
SELECT
  survey_slug,
  language,
  status,
  (date_trunc('day', started_at AT TIME ZONE 'UTC'))::date AS day,
  count(*)::bigint AS n,
  count(*) FILTER (WHERE status = 'completed')::bigint AS completed,
  count(*) FILTER (WHERE status = 'in_progress')::bigint AS in_progress,
  coalesce(
    sum(
      CASE
        WHEN completed_at IS NOT NULL
          AND started_at IS NOT NULL
          AND completed_at > started_at
          AND completed_at - started_at < interval '6 hours'
        THEN floor(extract(epoch FROM (completed_at - started_at)) * 1000)::bigint
        ELSE 0
      END
    ),
    0
  )::bigint AS duration_ms_sum,
  count(*) FILTER (
    WHERE completed_at IS NOT NULL
      AND started_at IS NOT NULL
      AND completed_at > started_at
      AND completed_at - started_at < interval '6 hours'
  )::bigint AS duration_count
FROM public.responses
GROUP BY survey_slug, language, status, (date_trunc('day', started_at AT TIME ZONE 'UTC'))::date;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_responses_touch ON public.responses;
CREATE TRIGGER trg_responses_touch
BEFORE UPDATE ON public.responses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── Row-level security ─────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses  ENABLE ROW LEVEL SECURITY;

-- Default deny. Public writes happen through a server function/role that
-- bypasses RLS, never directly from the client. Resume / update is also
-- gated server-side by the `resume_token`.
--
-- Supabase wiring (uncomment when deploying on Supabase):
--
-- CREATE POLICY "Admins can read responses"
--   ON public.responses FOR SELECT TO authenticated
--   USING (public.has_role(auth.uid(), 'admin'));
--
-- CREATE POLICY "Admins can read roles"
--   ON public.user_roles FOR SELECT TO authenticated
--   USING (public.has_role(auth.uid(), 'admin'));

-- ─── Done ───────────────────────────────────────────────────────────────────
