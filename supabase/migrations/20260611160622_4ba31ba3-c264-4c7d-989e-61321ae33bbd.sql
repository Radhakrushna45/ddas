
ALTER TABLE public.downloads ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE POLICY "Users upload own download files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'downloads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own download files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'downloads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own download files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'downloads' AND (storage.foldername(name))[1] = auth.uid()::text);
