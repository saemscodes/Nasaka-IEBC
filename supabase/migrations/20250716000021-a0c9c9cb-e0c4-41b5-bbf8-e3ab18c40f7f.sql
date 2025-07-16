
-- Drop existing policies on counties table
DROP POLICY IF EXISTS "Enable public read access" ON public.counties;

-- Drop existing policies on constituencies table  
DROP POLICY IF EXISTS "Enable public read access" ON public.constituencies;

-- Create comprehensive public access policies for counties
CREATE POLICY "Public can view all counties" 
ON public.counties 
FOR SELECT 
USING (true);

CREATE POLICY "Public can insert counties" 
ON public.counties 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update counties" 
ON public.counties 
FOR UPDATE 
USING (true);

CREATE POLICY "Public can delete counties" 
ON public.counties 
FOR DELETE 
USING (true);

-- Create comprehensive public access policies for constituencies
CREATE POLICY "Public can view all constituencies" 
ON public.constituencies 
FOR SELECT 
USING (true);

CREATE POLICY "Public can insert constituencies" 
ON public.constituencies 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update constituencies" 
ON public.constituencies 
FOR UPDATE 
USING (true);

CREATE POLICY "Public can delete constituencies" 
ON public.constituencies 
FOR DELETE 
USING (true);
