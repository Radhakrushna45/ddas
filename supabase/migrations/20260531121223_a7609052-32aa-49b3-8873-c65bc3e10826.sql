DROP POLICY IF EXISTS "All authenticated can view downloads" ON public.downloads;
CREATE POLICY "Users view own downloads" ON public.downloads FOR SELECT TO authenticated USING (auth.uid() = user_id);