-- =========================================================
-- 005_security_hardening.sql  |  Fixes from Supabase security advisors
--   1. set_updated_at: pin search_path (lint 0011)
--   2. handle_new_user: trigger-only, must not be callable via RPC (lint 0028/0029)
--   3. is_admin: not callable by anon; authenticated keeps it for RLS (lint 0028)
-- =========================================================

-- 1. Pin search_path on set_updated_at (now() lives in pg_catalog, always resolvable)
alter function public.set_updated_at() set search_path = '';

-- 2. handle_new_user is only ever fired by the on_auth_user_created trigger
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. is_admin: revoke from PUBLIC too, otherwise anon still inherits EXECUTE via PUBLIC
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;
