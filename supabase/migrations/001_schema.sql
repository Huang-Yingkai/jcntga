-- =========================================================
-- 001_schema.sql  |  US01 + US02 + US03 database schema
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =========================================================

-- ---------- Enum types ----------
create type public.user_role         as enum ('member', 'admin');
create type public.membership_status as enum ('pending', 'active', 'inactive', 'deceased');
create type public.renewal_status    as enum ('pending', 'approved', 'rejected');

-- ---------- profiles (one row per auth user) ----------
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  role                     public.user_role         not null default 'member',
  full_name                text                     not null default '',
  email                    text,
  ic_number                text unique
                           check (ic_number ~ '^\d{6}-?\d{2}-?\d{4}$'),
  phone                    text
                           check (phone ~ '^\+?[0-9 -]{9,15}$'),
  languages                text[]                   not null default '{}',
  emergency_contact_name   text,
  emergency_contact_phone  text,
  home_address             text,
  membership_status        public.membership_status not null default 'pending',
  membership_expiry        date,
  created_at               timestamptz              not null default now(),
  updated_at               timestamptz              not null default now()
);

-- ---------- renewals (US03: renewal request + payment proof) ----------
create table public.renewals (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.profiles (id) on delete cascade,
  years          smallint not null check (years between 1 and 3),
  amount_rm      numeric(8, 2) generated always as (years * 100) stored,  -- RM100 per year
  proof_path     text not null,          -- path inside the 'payment-proofs' bucket
  status         public.renewal_status not null default 'pending',
  reject_reason  text,
  reviewed_by    uuid references public.profiles (id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint reject_needs_reason
    check (status <> 'rejected' or coalesce(btrim(reject_reason), '') <> '')
);

create index renewals_status_created_idx on public.renewals (status, created_at);
create index renewals_member_idx         on public.renewals (member_id);

-- ---------- Helper: is the current user an admin? ----------
-- security definer so it can read profiles without being blocked by RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- Trigger: auto-create a profile when someone signs up ----------
-- Role is ALWAYS 'member' here; never trust role from sign-up metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Trigger: keep updated_at current ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
