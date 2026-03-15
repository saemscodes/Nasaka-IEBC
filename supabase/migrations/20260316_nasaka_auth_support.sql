-- ============================================================================
-- NASAKA IEBC: AUTH SUPPORT INFRASTRUCTURE
-- Creates profiles and triggers for seamless B2B user onboarding.
-- ============================================================================

-- 1. Create Nasaka Profiles table
CREATE TABLE IF NOT EXISTS public.nasaka_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_nasaka_user_profile UNIQUE(user_id)
);

-- 2. Enable RLS
ALTER TABLE public.nasaka_profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Users can view their own nasaka profile" ON public.nasaka_profiles;
CREATE POLICY "Users can view their own nasaka profile"
    ON public.nasaka_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own nasaka profile" ON public.nasaka_profiles;
CREATE POLICY "Users can update their own nasaka profile"
    ON public.nasaka_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Automatic User Onboarding Trigger
-- When a user signs up, we automatically create a profile and a Jamii (free) API key.
CREATE OR REPLACE FUNCTION public.handle_nasaka_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_raw_key TEXT;
    v_hash TEXT;
    v_key_prefix TEXT;
BEGIN
    -- A. Create Profile
    INSERT INTO public.nasaka_profiles (user_id, display_name)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'Developer')
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- B. Generate initial Jamii Key (Free tier)
    -- We generate a random hex string for the key
    v_raw_key := 'nasaka_' || encode(gen_random_bytes(16), 'hex');
    v_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
    v_key_prefix := left(v_raw_key, 12);

    INSERT INTO public.api_keys (
        user_id,
        key_hash,
        key_prefix,
        owner_name,
        owner_email,
        tier,
        plan_status,
        monthly_request_count,
        credits_balance
    ) VALUES (
        NEW.id,
        v_hash,
        v_key_prefix,
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'Developer'),
        NEW.email,
        'jamii',
        'active',
        0,
        0
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach trigger
DROP TRIGGER IF EXISTS on_nasaka_auth_user_created ON auth.users;
CREATE TRIGGER on_nasaka_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_nasaka_new_user();

-- 6. Add updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_nasaka_profiles_updated_at ON public.nasaka_profiles;
CREATE TRIGGER set_nasaka_profiles_updated_at
    BEFORE UPDATE ON public.nasaka_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.nasaka_profiles IS 'Developer profiles for the Nasaka B2B ecosystem.';
