ALTER TABLE public.downloads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.downloads;