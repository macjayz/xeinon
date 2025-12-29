-- Restore strict stage enforcement (no downgrades allowed)
CREATE OR REPLACE FUNCTION public.enforce_stage_progression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  old_order INTEGER;
  new_order INTEGER;
BEGIN
  old_order := CASE OLD.token_stage
    WHEN 'created' THEN 1
    WHEN 'discovered' THEN 2
    WHEN 'priced' THEN 3
    WHEN 'liquid' THEN 4
    WHEN 'traded' THEN 5
    WHEN 'dead' THEN 99
    ELSE 0
  END;
  
  new_order := CASE NEW.token_stage
    WHEN 'created' THEN 1
    WHEN 'discovered' THEN 2
    WHEN 'priced' THEN 3
    WHEN 'liquid' THEN 4
    WHEN 'traded' THEN 5
    WHEN 'dead' THEN 99
    ELSE 0
  END;
  
  -- Allow progression forward or to dead state only
  IF new_order < old_order AND NEW.token_stage != 'dead' THEN
    RAISE EXCEPTION 'Stage downgrade not allowed: % -> %', OLD.token_stage, NEW.token_stage;
  END IF;
  
  RETURN NEW;
END;
$function$;