
CREATE POLICY "Staff read wound photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wound-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff upload wound photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wound-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update wound photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'wound-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete wound photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'wound-photos' AND public.is_staff(auth.uid()));
