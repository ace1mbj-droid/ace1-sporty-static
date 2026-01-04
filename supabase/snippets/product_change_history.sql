-- Persistent product change history (audit) for admin operations

-- Table: public.product_changes

CREATE TABLE IF NOT EXISTS public.product_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  actor_id uuid NULL,
  actor_email text NULL,
  change_time timestamptz NOT NULL DEFAULT now(),
  change_summary text NULL,
  change_diff jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Basic index
CREATE INDEX IF NOT EXISTS idx_product_changes_product_id ON public.product_changes (product_id);
CREATE INDEX IF NOT EXISTS idx_product_changes_change_time ON public.product_changes (change_time DESC);

-- Grant basic privileges for roles that will read/write (note these will be limited via RLS below)
GRANT SELECT, INSERT ON public.product_changes TO anon, authenticated, service_role;

-- RLS policy: allow admin inserts/select when header-based admin session or user_roles says is_admin
ALTER TABLE public.product_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_changes_admin_access" ON public.product_changes;
CREATE POLICY "product_changes_admin_access"
  ON public.product_changes
  FOR ALL
  USING (
    public.ace1_is_admin_session() OR EXISTS(
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
  )
  WITH CHECK (
    public.ace1_is_admin_session() OR EXISTS(
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (select auth.uid()) AND ur.is_admin = true
    )
  );

-- Keep the table lean. Admins can insert when they are admin via ace1-session or role.

-- Optional: a verification query to view latest entries
-- SELECT * FROM public.product_changes WHERE product_id = '<uuid>' ORDER BY change_time DESC LIMIT 10;
