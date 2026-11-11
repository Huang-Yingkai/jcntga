-- =========================================================
-- 004_review_functions.sql  |  US03 approve / reject (optional helper)
-- One call updates BOTH the renewal and the member profile in a single
-- transaction, so the expiry date can never get out of sync.
-- Frontend / API:
--   supabase.rpc('approve_renewal', { p_renewal_id })
--   supabase.rpc('reject_renewal',  { p_renewal_id, p_reason })
-- =========================================================

create or replace function public.approve_renewal(p_renewal_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.renewals;
  p public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can approve renewals' using errcode = '42501';
  end if;

  select * into r from public.renewals where id = p_renewal_id for update;
  if not found then
    raise exception 'Renewal not found';
  end if;
  if r.status <> 'pending' then
    raise exception 'Renewal has already been %', r.status;
  end if;

  update public.renewals
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = r.id;

  -- Extend from the current expiry, or from today if already expired / never set
  update public.profiles
     set membership_status = 'active',
         membership_expiry = greatest(coalesce(membership_expiry, current_date), current_date)
                             + make_interval(years => r.years)
   where id = r.member_id
  returning * into p;

  return p;
end;
$$;

create or replace function public.reject_renewal(p_renewal_id uuid, p_reason text)
returns public.renewals
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.renewals;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can reject renewals' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to reject a renewal';
  end if;

  update public.renewals
     set status = 'rejected', reject_reason = btrim(p_reason),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_renewal_id and status = 'pending'
  returning * into r;

  if not found then
    raise exception 'Renewal not found or already reviewed';
  end if;
  return r;
end;
$$;

revoke execute on function public.approve_renewal(uuid)      from public, anon;
revoke execute on function public.reject_renewal(uuid, text) from public, anon;
grant  execute on function public.approve_renewal(uuid)      to authenticated;
grant  execute on function public.reject_renewal(uuid, text) to authenticated;
