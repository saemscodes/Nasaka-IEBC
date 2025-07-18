
-- Create the evidence storage bucket that's missing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/gif']
);

-- Create storage policies for evidence bucket
CREATE POLICY "Authenticated users can upload evidence files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'evidence' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view evidence files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'evidence' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update their evidence files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'evidence' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete their evidence files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'evidence' AND
  auth.uid() IS NOT NULL
);
