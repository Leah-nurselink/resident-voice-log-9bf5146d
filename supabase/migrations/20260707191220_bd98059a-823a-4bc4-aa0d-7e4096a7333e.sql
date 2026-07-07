
ALTER TABLE public.daily_notes REPLICA IDENTITY FULL;
ALTER TABLE public.care_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_sessions;
