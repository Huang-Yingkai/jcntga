import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SAMPLE_PROFILE = {
  id: 'demo-user-id',
  full_name: 'Alicia Tan',
  email: 'alicia@jcntga.dev',
  ic_number: '970101-10-1234',
  phone: '+6012-3456789',
  languages: ['English', 'Bahasa Malaysia'],
  emergency_contact_name: 'Rahman Tan',
  emergency_contact_phone: '+6013-7654321',
  home_address: 'No. 12, Jalan Bukit Indah, Johor Bahru, Johor',
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

function formatLanguages(value) {
  if (!value) return 'Not set';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') return value;
  return String(value);
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(SAMPLE_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const { getCurrentProfile } = await import('../lib/supabase.js');
        const currentProfile = await getCurrentProfile();

        if (isMounted) {
          setProfile(currentProfile ?? SAMPLE_PROFILE);
        }
      } catch (err) {
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

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: name === 'languages' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value,
    }));
    setSuccess('');
    setError('');
  };

  const handleSignOut = async () => {
    try {
      const { supabase } = await import('../lib/supabase.js');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { supabase } = await import('../lib/supabase.js');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile((current) => ({ ...current, ...profile }));
        setSuccess('Demo profile updated locally.');
        setSaving(false);
        return;
      }

      const payload = {
        full_name: profile.full_name,
        ic_number: profile.ic_number,
        phone: profile.phone,
        languages: Array.isArray(profile.languages) ? profile.languages : String(profile.languages || '').split(',').map((item) => item.trim()).filter(Boolean),
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
        home_address: profile.home_address,
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess('Profile saved successfully.');
    } catch (err) {
      setError(err.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f3ea] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">JCNTGA</p>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Profile</h1>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] rounded-xl border-2 border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white"
          >
            Sign Out
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Membership</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{profile.full_name || 'Tourist Guide'}</h2>
              </div>
              <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-emerald-900">
                {profile.membership_status || 'active'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Membership Expiry</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(profile.membership_expiry)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Full name</label>
                <input
                  name="full_name"
                  value={profile.full_name || ''}
                  onChange={handleChange}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">IC number</label>
                <input
                  name="ic_number"
                  value={profile.ic_number || ''}
                  onChange={handleChange}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Phone</label>
                <input
                  name="phone"
                  value={profile.phone || ''}
                  onChange={handleChange}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Languages</label>
                <input
                  name="languages"
                  value={formatLanguages(profile.languages)}
                  onChange={handleChange}
                  placeholder="English, Bahasa Malaysia"
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Emergency contact name</label>
                <input
                  name="emergency_contact_name"
                  value={profile.emergency_contact_name || ''}
                  onChange={handleChange}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Emergency contact phone</label>
                <input
                  name="emergency_contact_phone"
                  value={profile.emergency_contact_phone || ''}
                  onChange={handleChange}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Home address</label>
                <textarea
                  name="home_address"
                  value={profile.home_address || ''}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Status</p>
                <p className="mt-2 text-sm font-bold uppercase text-slate-900">{profile.membership_status || 'active'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Expiry</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{formatDate(profile.membership_expiry)}</p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{success}</div>
          ) : null}

          <button
            type="submit"
            disabled={saving || loading}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-base font-bold text-blue-900 transition hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-300 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <Link
            to="/dashboard"
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-slate-100 text-slate-900"
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
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-100 text-blue-900 font-bold"
          >
            <span className="text-sm font-bold">Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
