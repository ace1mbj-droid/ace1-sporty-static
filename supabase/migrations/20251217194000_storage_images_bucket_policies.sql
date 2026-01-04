-- Storage policies for Images bucket
-- Public read for Images
DROP POLICY IF EXISTS "Public read Images" ON storage.objects;
CREATE POLICY "Public read Images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'Images');
-- Authenticated can upload to Images
DROP POLICY IF EXISTS "Authenticated upload Images" ON storage.objects;
CREATE POLICY "Authenticated upload Images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'Images');
-- Admins can update Images
DROP POLICY IF EXISTS "Admins update Images" ON storage.objects;
CREATE POLICY "Admins update Images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'Images' AND security.is_admin())
WITH CHECK (bucket_id = 'Images' AND security.is_admin());
-- Admins can delete Images
DROP POLICY IF EXISTS "Admins delete Images" ON storage.objects;
CREATE POLICY "Admins delete Images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'Images' AND security.is_admin());
