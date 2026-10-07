ALTER TABLE public.communication_tasks ADD COLUMN IF NOT EXISTS wound_id uuid REFERENCES public.wounds(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_wound_review_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.review_date IS NULL OR NEW.status <> 'open' THEN
    UPDATE communication_tasks SET status = 'dismissed'
      WHERE wound_id = NEW.id AND status IN ('open','in_progress');
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.review_date IS NOT DISTINCT FROM OLD.review_date AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM communication_tasks WHERE wound_id = NEW.id AND status IN ('open','in_progress')) THEN
    UPDATE communication_tasks SET due_date = NEW.review_date,
      title = 'Wound review: ' || NEW.location
      WHERE wound_id = NEW.id AND status IN ('open','in_progress');
  ELSE
    INSERT INTO communication_tasks (resident_id, wound_id, kind, title, detail, due_date, priority, status, source, created_by)
    VALUES (NEW.resident_id, NEW.id, 'wound_review', 'Wound review: ' || NEW.location,
      'Nurse to review and record a wound assessment.', NEW.review_date, 'medium', 'open', 'wound_review', auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER wounds_review_task AFTER INSERT OR UPDATE ON public.wounds
FOR EACH ROW EXECUTE FUNCTION public.sync_wound_review_task();

INSERT INTO public.communication_tasks (resident_id, wound_id, kind, title, detail, due_date, priority, status, source)
SELECT w.resident_id, w.id, 'wound_review', 'Wound review: ' || w.location,
  'Nurse to review and record a wound assessment.', w.review_date, 'medium', 'open', 'wound_review'
FROM public.wounds w WHERE w.review_date IS NOT NULL AND w.status = 'open';