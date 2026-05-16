
-- Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Admins can read roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Survey responses (anonymous)
CREATE TABLE public.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_slug text NOT NULL,
  resume_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64'),
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'in_progress',
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact jsonb,
  progress_pct int NOT NULL DEFAULT 0,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX responses_survey_idx ON public.responses (survey_slug);
CREATE INDEX responses_status_idx ON public.responses (status);
CREATE INDEX responses_started_idx ON public.responses (started_at);

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Admins can read all responses; nobody else can read.
CREATE POLICY "Admins can read responses" ON public.responses
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- All response writes go through server functions using the service role.
-- No public INSERT/UPDATE policies — server-side only.

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER responses_touch_updated_at
BEFORE UPDATE ON public.responses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
