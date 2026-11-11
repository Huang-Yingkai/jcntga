-- =========================================================
-- 002_rls.sql  |  Row-Level Security (US01, US02, US03)
-- Rules:
--   * Members see and edit ONLY their own profile and renewals.
--   * Members cannot change role, membership status or expiry.
--   * Admin (Secretary) sees everything and reviews renewals.
--   * Logged-out users (anon) see nothing.
-- =========================================================

alter table public.profiles enable row level security;
alter table public.renewals enable row level security;

-- ---------- profiles ----------
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: admin updates all"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/delete policies: profiles are created by the sign-up trigger.

-- Block members from editing protected columns on their own row.
-- NOT security definer on purpose: current_user must be the caller's role.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role              is distinct from old.role
    or new.membership_status is distinct from old.membership_status
    or new.membership_expiry is distinct from old.membership_expiry
    or new.id                is distinct from old.id then
      raise exception 'Only the admin can change role, membership status or expiry date'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------- renewals ----------
create policy "renewals: read own"
  on public.renewals for select to authenticated
  using (member_id = auth.uid());

create policy "renewals: admin reads all"
  on public.renewals for select to authenticated
  using (public.is_admin());

-- Members can only submit a NEW pending request for themselves,
-- with the proof file stored in their own folder.
create policy "renewals: member submits own"
  on public.renewals for insert to authenticated
  with check (
    member_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and proof_path like auth.uid()::text || '/%'
  );

create policy "renewals: admin reviews"
  on public.renewals for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No delete policy: renewal history is kept.

-- ---------- Table privileges (Supabase grants these by default; kept explicit) ----------
grant usage on schema public to anon, authenticated;
grant select, update          on public.profiles to authenticated;
grant select, insert, update  on public.renewals to authenticated;
grant execute on function public.is_admin() to authenticated;
