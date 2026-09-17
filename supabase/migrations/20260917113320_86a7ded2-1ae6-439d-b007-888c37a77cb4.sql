
CREATE POLICY "Staff read resident photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resident-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff upload resident photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resident-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update resident photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resident-photos' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'resident-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete resident photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resident-photos' AND public.is_staff(auth.uid()));
