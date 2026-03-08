
-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,
  52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/x-msvideo','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Analyses table
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'document')),
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed')),
  authenticity_level TEXT CHECK (authenticity_level IN ('authentic', 'suspicious', 'manipulated', 'uncertain')),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  summary TEXT,
  details JSONB DEFAULT '[]'::jsonb,
  exif_data JSONB,
  hash_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own analyses"
  ON public.analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON public.analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON public.analyses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
