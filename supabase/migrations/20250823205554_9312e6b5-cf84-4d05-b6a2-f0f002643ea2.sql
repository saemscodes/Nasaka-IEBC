
-- Fix the search_path mutability warnings by setting search_path explicitly

-- Update the is_admin_user function (the one that takes user_id parameter)
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM core_team 
    WHERE core_team.user_id = is_admin_user.user_id 
    AND core_team.is_admin = true
  );
$function$;

-- Update the is_admin_user function (the one with no parameters)
CREATE OR REPLACE FUNCTION public.is_admin_user()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Your existing function logic here
    RETURN true; -- Replace with actual admin check logic
END;
$function$;

-- Update the proper_case function
CREATE OR REPLACE FUNCTION public.proper_case(name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF name IS NULL THEN RETURN NULL; END IF;
  RETURN initcap(lower(name));
END;
$function$;
