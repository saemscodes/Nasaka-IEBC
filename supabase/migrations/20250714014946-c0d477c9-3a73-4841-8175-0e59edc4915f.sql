-- Update RLS policies to allow public petition creation and viewing
-- Remove authentication requirement for petition creation

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create petitions" ON public.petitions;
DROP POLICY IF EXISTS "Petition creators can update their petitions" ON public.petitions;

-- Create new public policies for petitions
CREATE POLICY "Anyone can view active petitions" 
ON public.petitions 
FOR SELECT 
USING (status = 'active');

CREATE POLICY "Anyone can create petitions" 
ON public.petitions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public petition updates" 
ON public.petitions 
FOR UPDATE 
USING (true);

-- Update signatures policies
DROP POLICY IF EXISTS "Authenticated users can create signatures" ON public.signatures;

CREATE POLICY "Anyone can create signatures" 
ON public.signatures 
FOR INSERT 
WITH CHECK (true);