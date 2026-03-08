CREATE POLICY "Users can delete own analyses"
ON public.analyses
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);