
-- enums
CREATE TYPE public.app_role AS ENUM ('carer','senior_carer','nurse','manager','admin');
CREATE TYPE public.care_plan_domain AS ENUM ('personal_care','mobility','nutrition','continence','skin_integrity','communication','mental_health','cognition','medication','breathing','sleep','safety','social','end_of_life');
CREATE TYPE public.risk_assessment_type AS ENUM ('falls','pressure','nutrition','moving_handling','continence','medication','environmental','behavioural','mental_capacity','general');
CREATE TYPE public.risk_level AS ENUM ('low','medium','high');
CREATE TYPE public.note_status AS ENUM ('draft','approved');
CREATE TYPE public.alert_severity AS ENUM ('info','warning','critical');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- handle new user trigger: profile + default 'carer' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'carer');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- timestamp trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- residents
CREATE TABLE public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  room_number TEXT,
  date_of_birth DATE,
  photo_url TEXT,
  nhs_number TEXT,
  admission_date DATE DEFAULT CURRENT_DATE,
  gp JSONB DEFAULT '{}'::jsonb,
  next_of_kin JSONB DEFAULT '{}'::jsonb,
  key_risks JSONB DEFAULT '{}'::jsonb,
  tag_id TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residents TO authenticated;
GRANT ALL ON public.residents TO service_role;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access residents" ON public.residents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER residents_touch BEFORE UPDATE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- care_plans
CREATE TABLE public.care_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  domain public.care_plan_domain NOT NULL,
  needs TEXT,
  risks TEXT,
  outcome TEXT,
  content TEXT,
  last_review DATE,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resident_id, domain)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plans TO authenticated;
GRANT ALL ON public.care_plans TO service_role;
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access care_plans" ON public.care_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER care_plans_touch BEFORE UPDATE ON public.care_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- risk_assessments
CREATE TABLE public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  type public.risk_assessment_type NOT NULL,
  level public.risk_level NOT NULL DEFAULT 'low',
  factors TEXT,
  controls TEXT,
  review_date DATE,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resident_id, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessments TO authenticated;
GRANT ALL ON public.risk_assessments TO service_role;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access risk_assessments" ON public.risk_assessments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER risk_assessments_touch BEFORE UPDATE ON public.risk_assessments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- daily_notes
CREATE TABLE public.daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  transcript TEXT,
  content TEXT NOT NULL,
  domain public.care_plan_domain,
  risks public.risk_assessment_type[] DEFAULT '{}',
  flags TEXT[] DEFAULT '{}',
  status public.note_status NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL DEFAULT 'voice',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_notes TO authenticated;
GRANT ALL ON public.daily_notes TO service_role;
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access daily_notes" ON public.daily_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER daily_notes_touch BEFORE UPDATE ON public.daily_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX daily_notes_resident_created ON public.daily_notes (resident_id, created_at DESC);

-- alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES public.residents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access alerts" ON public.alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- family_members
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT,
  email TEXT,
  phone TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access family_members" ON public.family_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
