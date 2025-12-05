-- Create password_reset_logs table to record admin-initiated password resets
BEGIN;

CREATE TABLE IF NOT EXISTS public.password_reset_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id text,
    admin_email text,
    target_user_id text,
    target_email text,
    ip_address text,
    user_agent text,
    note text,
    created_at timestamptz DEFAULT now()
);

-- Optional index to make queries by target_user_id faster
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_target_user ON public.password_reset_logs(target_user_id);

COMMIT;
