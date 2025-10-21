-- Create missing update timestamp function
CREATE OR REPLACE FUNCTION update_iebc_office_contributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create iebc-contributions storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'iebc-contributions',
  'iebc-contributions', 
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for iebc-contributions bucket
CREATE POLICY "Anyone can upload contribution images"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'iebc-contributions');

CREATE POLICY "Anyone can view contribution images"
ON storage.objects FOR SELECT
USING (bucket_id = 'iebc-contributions');

CREATE POLICY "Users can update their own contribution images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'iebc-contributions');

CREATE POLICY "Admins can delete contribution images"
ON storage.objects FOR DELETE
USING (bucket_id = 'iebc-contributions' AND auth.role() = 'authenticated');