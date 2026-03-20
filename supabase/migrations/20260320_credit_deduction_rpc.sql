-- ============================================================================
-- NASAKA IEBC: CREDIT DEDUCTION RPC
-- Migration 20260320 — Adds deduct_credits function for atomic credit deduction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deduct_credits(p_key_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.api_keys
    SET credits_balance = GREATEST(credits_balance - p_amount, 0)
    WHERE id = p_key_id
      AND is_active = true
      AND credits_balance > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
