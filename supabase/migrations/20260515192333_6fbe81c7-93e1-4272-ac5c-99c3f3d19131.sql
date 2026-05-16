ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;
ALTER TABLE public.responses REPLICA IDENTITY FULL;