-- Drop and recreate policies properly
DROP POLICY IF EXISTS "Anyone can view active petitions" ON public.petitions;
DROP POLICY IF EXISTS "Authenticated users can create petitions" ON public.petitions;
DROP POLICY IF EXISTS "Petition creators can update their petitions" ON public.petitions;
DROP POLICY IF EXISTS "Anyone can create petitions" ON public.petitions;
DROP POLICY IF EXISTS "Public petition updates" ON public.petitions;

-- Create new public policies for petitions
CREATE POLICY "Public can view active petitions" 
ON public.petitions 
FOR SELECT 
USING (status = 'active');

CREATE POLICY "Public can create petitions" 
ON public.petitions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update petitions" 
ON public.petitions 
FOR UPDATE 
USING (true);

-- Update signatures policies
DROP POLICY IF EXISTS "Authenticated users can create signatures" ON public.signatures;
DROP POLICY IF EXISTS "Anyone can create signatures" ON public.signatures;

CREATE POLICY "Public can create signatures" 
ON public.signatures 
FOR INSERT 
WITH CHECK (true);