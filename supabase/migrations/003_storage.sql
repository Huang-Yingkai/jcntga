-- =========================================================
-- 003_storage.sql  |  US03 payment-proof storage
-- Private bucket. Files go to:  payment-proofs/<user id>/<file name>
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,                                   -- private: no public URLs
  5242880,                                 -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Member uploads only into their own folder
create policy "proofs: member uploads own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Member views only their own files
create policy "proofs: member reads own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin views all proofs (for the Pending Approvals preview)
create policy "proofs: admin reads all"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());

-- No update/delete policies: submitted proofs cannot be replaced or removed.
