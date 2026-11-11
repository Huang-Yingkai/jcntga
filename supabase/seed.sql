-- =========================================================
-- seed.sql  |  FICTIONAL test data only (no real member data)
-- Step 1: Supabase Dashboard -> Authentication -> Users -> Add user
--         create:  admin@test.jcntga.dev   and   member@test.jcntga.dev
--         (tick "Auto Confirm User")
-- Step 2: run this file in the SQL Editor.
-- =========================================================

update public.profiles
   set role = 'admin', full_name = 'Test Secretary', membership_status = 'active'
 where email = 'admin@test.jcntga.dev';

update public.profiles
   set full_name               = 'Ali Test Guide',
       ic_number               = '900101-01-1234',
       phone                   = '012-345 6789',
       languages               = array['Malay', 'English'],
       emergency_contact_name  = 'Siti Test',
       emergency_contact_phone = '013-987 6543',
       home_address            = '1 Jalan Contoh, 80000 Johor Bahru',
       membership_status       = 'active',
       membership_expiry       = current_date + 30
 where email = 'member@test.jcntga.dev';
