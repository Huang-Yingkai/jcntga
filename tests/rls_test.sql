-- RLS checks for Sprint 1. Each check prints PASS or raises an error (FAIL).
-- Uses fictional users only.
\set ON_ERROR_STOP on
set client_min_messages = notice;
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.jcntga.dev',  '{"full_name":"Test Secretary","role":"admin"}'),
  ('00000000-0000-0000-0000-000000000001', 'member1@test.jcntga.dev','{"full_name":"Ali"}'),
  ('00000000-0000-0000-0000-000000000002', 'member2@test.jcntga.dev','{"full_name":"Bala"}');
update public.profiles set role = 'admin' where email = 'admin@test.jcntga.dev';
update public.profiles set membership_status = 'active', membership_expiry = current_date + 10
 where email = 'member1@test.jcntga.dev';

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

create or replace function pg_temp.fails(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return true; end $$;
grant execute on function pg_temp.fails(text) to anon, authenticated;

-- ===== Sign-up trigger =====
select pg_temp.check((select count(*) = 3 from public.profiles), 'sign-up trigger creates a profile for every new user');
select pg_temp.check((select role = 'member' from public.profiles where email = 'member1@test.jcntga.dev'),
                     'new users are members by default');

-- ===== anon (logged out) =====
set role anon;
select pg_temp.check(pg_temp.fails('select 1 from public.profiles'), 'US01 AC3: logged-out user cannot read profiles');
reset role;

-- ===== member1 =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select pg_temp.check((select count(*) = 1 from public.profiles), 'member sees only own profile');
select pg_temp.check(not public.is_admin(), 'member is not admin');

update public.profiles set phone = '012-111 2222', languages = array['Malay','Mandarin'] where id = auth.uid();
select pg_temp.check((select phone = '012-111 2222' from public.profiles where id = auth.uid()), 'US02: member updates own profile');

update public.profiles set phone = '019-000 0000' where email = 'member2@test.jcntga.dev';


select pg_temp.check(pg_temp.fails($q$update public.profiles set role = 'admin' where id = auth.uid()$q$),
                     'member cannot make self admin');
select pg_temp.check(pg_temp.fails($q$update public.profiles set membership_expiry = '2099-01-01' where id = auth.uid()$q$),
                     'member cannot change own expiry date');
select pg_temp.check(pg_temp.fails($q$update public.profiles set ic_number = 'abc' where id = auth.uid()$q$),
                     'US02 AC2 (server side): invalid IC number rejected');

insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-000000000001/proof.jpg');
select pg_temp.check(true, 'US03: member uploads proof into own folder');
select pg_temp.check(pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-000000000002/x.jpg')$q$),
                     'member cannot upload into another member folder');

insert into public.renewals (member_id, years, proof_path)
values (auth.uid(), 2, '00000000-0000-0000-0000-000000000001/proof.jpg');
select pg_temp.check((select amount_rm = 200 from public.renewals where member_id = auth.uid()), 'US03 AC1: member submits 2-year renewal (RM200)');

select pg_temp.check(pg_temp.fails($q$insert into public.renewals (member_id, years, proof_path, status) values (auth.uid(), 1, '00000000-0000-0000-0000-000000000001/p.jpg', 'approved')$q$),
                     'member cannot submit a pre-approved renewal');
select pg_temp.check(pg_temp.fails($q$insert into public.renewals (member_id, years, proof_path) values (auth.uid(), 5, '00000000-0000-0000-0000-000000000001/p.jpg')$q$),
                     'renewal years limited to 1-3');
select pg_temp.check(pg_temp.fails($q$insert into public.renewals (member_id, years, proof_path) values ('00000000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-000000000002/p.jpg')$q$),
                     'member cannot submit renewal for someone else');
select pg_temp.check(pg_temp.fails($q$select public.approve_renewal((select id from public.renewals limit 1))$q$),
                     'member cannot approve renewals');
reset role;

-- ===== member2 =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) = 0 from public.renewals), 'member2 cannot see member1 renewal');
select pg_temp.check((select count(*) = 0 from storage.objects), 'member2 cannot see member1 payment proof');
reset role;

-- ===== admin =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check(public.is_admin(), 'US01 AC2: secretary is admin');
select pg_temp.check((select phone is null from public.profiles where email = 'member2@test.jcntga.dev'),
                     'US02: member1 could not edit member2 profile');
select pg_temp.check((select count(*) = 3 from public.profiles), 'admin sees all profiles');
select pg_temp.check((select count(*) = 1 from public.renewals where status = 'pending'), 'US03 AC2: renewal appears in Pending Approvals');
select pg_temp.check((select count(*) = 1 from storage.objects), 'admin can open payment proof');

select public.approve_renewal((select id from public.renewals where status = 'pending' limit 1));
select pg_temp.check((select membership_status = 'active' and membership_expiry = (current_date + 10 + interval '2 years')::date
                        from public.profiles where email = 'member1@test.jcntga.dev'),
                     'US03 AC3: approve sets Active and extends expiry by 2 years from current expiry');
select pg_temp.check(pg_temp.fails($q$select public.approve_renewal((select id from public.renewals limit 1))$q$),
                     'cannot approve the same renewal twice');
reset role;

-- reject path: member2 submits, admin rejects with reason
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-000000000002/p.png');
insert into public.renewals (member_id, years, proof_path) values (auth.uid(), 1, '00000000-0000-0000-0000-000000000002/p.png');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check(pg_temp.fails($q$select public.reject_renewal((select id from public.renewals where status='pending'), '  ')$q$),
                     'reject without a reason is blocked');
select public.reject_renewal((select id from public.renewals where status = 'pending'), 'Screenshot is blurry, please re-upload');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.check((select reject_reason = 'Screenshot is blurry, please re-upload' from public.renewals),
                     'US03 AC4: member sees the reject reason');
reset role;
\o
\echo ALL CHECKS PASSED
