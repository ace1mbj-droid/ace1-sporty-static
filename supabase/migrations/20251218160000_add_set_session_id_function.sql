-- Create a function to set the session_id for RLS policies
CREATE OR REPLACE FUNCTION public.set_session_id(session_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set the session variable that RLS policies check
  PERFORM set_config('app.session_id', session_id, false);
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.set_session_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_id(TEXT) TO anon;
