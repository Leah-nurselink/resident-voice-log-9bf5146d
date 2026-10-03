DROP POLICY "Medication staff add stock events" ON public.medication_stock_events;
CREATE POLICY "Medication staff add stock events" ON public.medication_stock_events FOR INSERT TO authenticated
  WITH CHECK (public.can_write(auth.uid(), 'administer_medication') OR public.can_write(auth.uid(), 'manage_medications'));

CREATE OR REPLACE FUNCTION public.apply_medication_stock_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.count_after IS NOT NULL THEN
    UPDATE medications SET stock_count = NEW.count_after,
      stock_counted_at = CASE WHEN NEW.kind IN ('recount','delivery') OR NEW.count_before IS NOT NULL THEN now() ELSE stock_counted_at END
    WHERE id = NEW.medication_id;
  END IF;
  IF NEW.kind = 'delivery' THEN
    UPDATE medications SET cycle_start_date = current_date,
      cycle_end_date = COALESCE((NEW.notes::jsonb->>'cycle_end')::date, current_date + 28),
      cycle_quantity = NEW.quantity
    WHERE id = NEW.medication_id AND NEW.notes IS NOT NULL AND NEW.notes LIKE '{%';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_medication_stock_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER apply_medication_stock_event AFTER INSERT ON public.medication_stock_events FOR EACH ROW EXECUTE FUNCTION public.apply_medication_stock_event();