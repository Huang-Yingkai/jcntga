import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SAMPLE_PROFILE = {
  full_name: 'Alicia Tan',
  membership_status: 'active',
  membership_expiry: '2027-12-31',
  role: 'member',
};

function formatDate(value) {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatStatus(value) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(SAMPLE_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const { getCurrentProfile } = await import('../lib/supabase.js');
        const currentProfile = await getCurrentProfile();

        if (isMounted) {
          setProfile(currentProfile ?? SAMPLE_PROFILE);
        }
      } catch (error) {
        if (isMounted) {
          setProfile(SAMPLE_PROFILE);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusClasses = useMemo(() => {
    const status = (profile.membership_status || 'active').toLowerCase();
    if (status === 'active') {
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    }
    if (status === 'pending') {
      return 'bg-amber-100 text-amber-900 border-amber-300';
    }
    return 'bg-slate-200 text-slate-800 border-slate-300';
  }, [profile.membership_status]);

  const handleSignOut = async () => {
    try {
      const { supabase } = await import('../lib/supabase.js');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f1e8] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-8 pt-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">JCNTGA</p>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border-2 border-blue-800 bg-blue-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-900">
              {loading ? 'Loading' : formatStatus(profile.membership_status)}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] rounded-xl border-2 border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white"
            >
              Sign Out
            </button>
          </div>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-slate-300 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 text-white shadow-[0_18px_42px_rgba(15,23,42,0.2)]">
          <div className="border-b border-white/20 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">Membership</span>
              <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100">
                IC Guide
              </span>
            </div>
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Guide</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight">{profile.full_name || 'Tourist Guide'}</h2>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Status</p>
              <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses}`}>
                {formatStatus(profile.membership_status)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Membership expiry</p>
              <p className="mt-2 text-lg font-bold text-white">{formatDate(profile.membership_expiry)}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          <Link
            to="/profile"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-base font-bold text-blue-900 shadow-[0_8px_18px_rgba(30,64,175,0.15)] transition hover:bg-blue-200"
          >
            View Profile
          </Link>

          <Link
            to="/renew"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-base font-bold text-slate-900 shadow-[0_8px_18px_rgba(245,158,11,0.28)] transition hover:bg-amber-400"
          >
            Renew Membership
          </Link>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-300 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <Link
            to="/dashboard"
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-100 text-blue-900 font-bold"
          >
            <span className="text-sm font-bold">Home</span>
          </Link>
          <Link
            to="/renew"
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-amber-100 text-amber-900"
          >
            <span className="text-sm font-bold">Renew</span>
          </Link>
          <Link
            to="/profile"
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-slate-100 text-slate-900"
          >
            <span className="text-sm font-bold">Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
