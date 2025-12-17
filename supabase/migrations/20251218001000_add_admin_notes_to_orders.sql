-- Add admin_notes column to orders table
-- This column is used by admin panel to store internal notes about orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes text;

COMMENT ON COLUMN orders.admin_notes IS 'Internal admin notes about this order (visible to admins only)';
