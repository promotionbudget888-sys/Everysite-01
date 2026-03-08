
CREATE OR REPLACE FUNCTION public.transfer_matching_to_everysite(
  p_amount numeric,
  p_profile_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_budget_mf numeric;
  v_used_mf numeric;
  v_pending_mf numeric;
  v_remaining numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'จำนวนเงินต้องมากกว่า 0';
  END IF;

  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'ต้องระบุ profile id';
  END IF;

  -- Lock the row to prevent race conditions
  SELECT budget_matching_fund, used_matching_fund, pending_matching_fund
  INTO v_budget_mf, v_used_mf, v_pending_mf
  FROM profiles
  WHERE id::text = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบข้อมูลผู้ใช้';
  END IF;

  -- Calculate remaining = total - used - pending
  v_remaining := v_budget_mf - v_used_mf - v_pending_mf;

  IF v_remaining < p_amount THEN
    RAISE EXCEPTION 'งบ Matching Fund คงเหลือไม่เพียงพอ (คงเหลือ: %)', v_remaining;
  END IF;

  -- Transfer: reduce MF total, increase ES total
  UPDATE profiles
  SET budget_matching_fund = budget_matching_fund - p_amount,
      budget_everysite = budget_everysite + p_amount,
      updated_at = now()
  WHERE id::text = p_profile_id;
END;
$$;
