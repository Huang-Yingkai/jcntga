# JCNTGA Guide Management System – Backend Setup (Sprint 1)

Supabase backend for US01–US03: database schema, login roles, Row-Level Security, payment-proof storage and environment variables.

| Story | Task | Files |
|---|---|---|
| US01 | Supabase Auth, user schema, environment variables | `supabase/migrations/001_schema.sql`, `src/lib/supabase.js`, `.env.example` |
| US02 | RLS policies to protect profile data | `supabase/migrations/002_rls.sql` |
| US03 | Storage bucket for payment proofs | `supabase/migrations/003_storage.sql` |
| US03 | Approve / reject functions (optional helper) | `supabase/migrations/004_review_functions.sql` |
| – | Security hardening | `supabase/migrations/005_security_hardening.sql` |

The migrations are **already applied** to the team's Supabase project. You do not need to run them again.

## Getting started (teammates)

1. Clone the repo and install packages:
   ```bash
   git clone https://github.com/Huang-Yingkai/jcntga.git
   cd jcntga
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the project URL and anon key (ask Yingkai for the values).
   **Never commit `.env`.** Never use the `service_role` key in the frontend.
3. Test accounts (fictional data only): `admin@test.jcntga.dev` and `member@test.jcntga.dev`. Ask Yingkai for the passwords.

## How to use it in your code

```js
import { supabase, getCurrentProfile, proofPath, PROOF_BUCKET } from './lib/supabase';

// Login and route by role (US01)
await supabase.auth.signInWithPassword({ email, password });
const profile = await getCurrentProfile();
if (profile?.role === 'admin') { /* go to admin dashboard */ } else { /* go to member portal */ }

// Update own profile (US02)
await supabase.from('profiles').update({ phone, home_address }).eq('id', profile.id);

// Upload payment proof and submit a renewal (US03)
const path = proofPath(profile.id, file.name);   // always use proofPath()
await supabase.storage.from(PROOF_BUCKET).upload(path, file);
await supabase.from('renewals').insert({ member_id: profile.id, years: 2, proof_path: path });

// Admin: approve or reject (US03)
await supabase.rpc('approve_renewal', { p_renewal_id: id });
await supabase.rpc('reject_renewal',  { p_renewal_id: id, p_reason: 'Screenshot is blurry' });

// Admin: preview a proof (private bucket, so use a temporary link)
const { data } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 60);
```

## Database fields

**profiles** – `id`, `role` (member / admin), `full_name`, `email`, `ic_number`, `phone`, `languages` (text array), `emergency_contact_name`, `emergency_contact_phone`, `home_address`, `membership_status` (pending / active / inactive / deceased), `membership_expiry`

**renewals** – `id`, `member_id`, `years` (1–3), `amount_rm` (auto: RM100 × years), `proof_path`, `status` (pending / approved / rejected), `reject_reason`, `reviewed_by`, `reviewed_at`, `created_at`

Please use these exact field names in forms and API calls.

## Access rules (RLS)

- **Logged out:** no access to any data.
- **Member:** can read and update only their own profile and renewals. Cannot change their own role, membership status or expiry date.
- **Payment proofs:** a member can upload only into their own folder (`<user id>/...`), cannot see other members' files, and cannot replace or delete a submitted file.
- **Admin (Secretary):** can read all profiles and proofs, and approve or reject renewals. A reason is required to reject.
- **Approve:** sets the member to Active and extends the expiry date by the selected number of years (from the current expiry date, or from today if it has already expired).

## Tests

- `scripts/check-connection.js` – logs in as the test member and admin on the live project and checks what each can see. Run with `node scripts/check-connection.js` (it asks for the passwords; they are not saved).
- `tests/run_local.sh` – runs the migrations and 27 RLS checks on a local PostgreSQL.
- `tests/supabase_mock.sql` is for local testing only. **Do not run it on the real Supabase project.**

## Setting up a new Supabase project (only if we ever need to start over)

1. supabase.com → New project (Region: Singapore).
2. SQL Editor → run `001` to `005` in `supabase/migrations/` in order.
3. Authentication → Users → add the two test accounts (tick Auto Confirm User), then run `supabase/seed.sql`.
4. Project Settings → API → copy the Project URL and anon key into `.env`.

## Deployment (Vercel) – not set up yet

1. vercel.com → Add New → Project → select this repo.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Environment Variables.
3. Deploy. Every push to `main` deploys automatically; pull requests get a preview link (staging).
4. In Supabase → Authentication → URL Configuration, add the Vercel URL to Site URL / Redirect URLs.
