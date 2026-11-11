// scripts/check-connection.js
// Verifies Supabase connection + RLS on public.profiles.
// Passwords are asked at runtime (hidden input) and never stored.
// Run:  node scripts/check-connection.js

import 'dotenv/config';
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const ACCOUNTS = [
  { label: 'member', email: 'member@test.jcntga.dev', expectedRows: 1, expectedRole: 'member' },
  { label: 'admin', email: 'admin@test.jcntga.dev', expectedRows: 2, expectedRole: 'admin' },
];

// Prompt without echoing what is typed
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function newClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const results = [];

// 1. Not logged in
{
  const supabase = newClient();
  const { data, error } = await supabase.from('profiles').select('id, role');
  const rows = data?.length ?? 0;
  // anon has no table grant on profiles, so Postgres returns 42501 instead of 0 rows.
  // Either way anon sees nothing, which is what we want.
  const denied = error?.code === '42501';
  results.push({
    case: 'anon (not logged in)',
    rows: denied ? '0 (permission denied)' : error ? `error: ${error.message}` : rows,
    ownRole: '-',
    expected: '0 rows',
    pass: denied || (!error && rows === 0),
  });
}

// 2. Each account
for (const acc of ACCOUNTS) {
  const password = await askHidden(`Password for ${acc.email}: `);
  const supabase = newClient();

  const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
    email: acc.email,
    password,
  });
  if (loginErr) {
    results.push({
      case: acc.label,
      rows: `login failed: ${loginErr.message}`,
      ownRole: '-',
      expected: `${acc.expectedRows} rows, role=${acc.expectedRole}`,
      pass: false,
    });
    continue;
  }

  const { data, error } = await supabase.from('profiles').select('id, role');
  const rows = data?.length ?? 0;
  const ownRole = data?.find((r) => r.id === auth.user.id)?.role ?? '(not visible)';
  results.push({
    case: acc.label,
    rows: error ? `error: ${error.message}` : rows,
    ownRole,
    expected: `${acc.expectedRows} rows, role=${acc.expectedRole}`,
    pass: !error && rows === acc.expectedRows && ownRole === acc.expectedRole,
  });

  await supabase.auth.signOut();
}

console.log();
console.table(results.map((r) => ({ ...r, pass: r.pass ? 'PASS' : 'FAIL' })));
process.exit(results.every((r) => r.pass) ? 0 : 1);
