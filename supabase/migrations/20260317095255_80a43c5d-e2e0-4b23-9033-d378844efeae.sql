CREATE TABLE public.training_dataset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  label text NOT NULL CHECK (label IN ('authentic', 'manipulated')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_dataset ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dataset entries"
  ON public.training_dataset FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dataset entries"
  ON public.training_dataset FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dataset entries"
  ON public.training_dataset FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own dataset entries"
  ON public.training_dataset FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);