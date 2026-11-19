import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const COMMON_LANGUAGE_OPTIONS = ['English', 'Bahasa Melayu', 'Mandarin', 'Cantonese', 'Hokkien', 'Hakka', 'Teochew',
                                  'Tamil', 'Hindi', 'Japanese', 'Korean', 'Thai', 'Vietnamese', 'Indonesian',
                                  'Arabic', 'French', 'German', 'Spanish', 'Italian', 'Portuguese', 'Russian',
                                  'Dutch', 'Turkish', 'Filipino'];

const EMPTY_PROFILE = { languages: [] };

const PROFILE_LOAD_ERROR = 'Unable to load your profile. Please refresh the page or sign in again.';

function normalizeLanguageValue(value) {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  const aliases = {
    'bahasa malaysia': 'bahasa melayu',
    'bahasa melayu': 'bahasa melayu',
    'malay': 'bahasa melayu',
  };

  return aliases[normalized] || normalized;
}

function splitOtherLanguages(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

// Case-insensitive de-duplication that keeps the first spelling seen.
function dedupeLanguages(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeLanguageValue(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLanguageSelections(languages) {
  const values = Array.isArray(languages) ? languages : typeof languages === 'string' ? languages.split(',') : [];
  const selected = [];
  const other = [];

  values.forEach((entry) => {
    const value = String(entry || '').trim();
    if (!value) return;

    const selectedLanguage = COMMON_LANGUAGE_OPTIONS.find(
      (language) => normalizeLanguageValue(language) === normalizeLanguageValue(value)
    );

    if (selectedLanguage) {
      selected.push(selectedLanguage);
      return;
    }

    other.push(value);
  });

  const uniqueSelected = dedupeLanguages(selected);
  const uniqueOther = dedupeLanguages(other);

  return {
    selected: uniqueSelected,
    other: uniqueOther.join(', '),
  };
}

function buildLanguagesArray(selectedLanguages, otherLanguagesString) {
  const selected = Array.isArray(selectedLanguages) ? selectedLanguages : [];
  const other = splitOtherLanguages(otherLanguagesString);

  return dedupeLanguages([...selected, ...other].map((item) => String(item ?? '').trim()).filter(Boolean));
}

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
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loadError, setLoadError] = useState('');
  const [otherLanguages, setOtherLanguages] = useState('');
  const [newOtherLanguage, setNewOtherLanguage] = useState('');
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

        if (!isMounted) return;

        if (!currentProfile) {
          // Never fall back to placeholder data: keep the form empty and saving blocked.
          setProfile(EMPTY_PROFILE);
          setOtherLanguages('');
          setLoadError(PROFILE_LOAD_ERROR);
          return;
        }

        const { selected, other } = getLanguageSelections(currentProfile.languages);
        setProfile({ ...currentProfile, languages: selected });
        setOtherLanguages(other);
        setLoadError('');
      } catch (err) {
        console.error('Profile load failed:', err);
        if (isMounted) {
          setProfile(EMPTY_PROFILE);
          setOtherLanguages('');
          setLoadError(PROFILE_LOAD_ERROR);
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
      [name]: value,
    }));
    setSuccess('');
    setError('');
  };

  const handleLanguageToggle = (language) => {
    setProfile((current) => {
      const currentLanguages = Array.isArray(current.languages) ? current.languages : [];
      const hasLanguage = currentLanguages.some(
        (item) => normalizeLanguageValue(item) === normalizeLanguageValue(language)
      );

      const nextLanguages = hasLanguage
        ? currentLanguages.filter((item) => normalizeLanguageValue(item) !== normalizeLanguageValue(language))
        : [...currentLanguages, language];

      return {
        ...current,
        languages: nextLanguages,
      };
    });
    setSuccess('');
    setError('');
  };

    const addOtherLanguage = () => {
  const values = splitOtherLanguages(newOtherLanguage);
  if (values.length === 0) return;

  const selectedKeys = new Set((profile.languages || []).map(normalizeLanguageValue));
  const otherList = splitOtherLanguages(otherLanguages);
  const otherKeys = new Set(otherList.map(normalizeLanguageValue));
  const commonToSelect = [];
  const duplicates = [];

  values.forEach((value) => {
    const key = normalizeLanguageValue(value);

    // If it matches a language in the dropdown, select it there instead of adding a custom chip
    const commonMatch = COMMON_LANGUAGE_OPTIONS.find(
      (language) => normalizeLanguageValue(language) === key
    );
    if (commonMatch) {
      if (!selectedKeys.has(key)) {
        selectedKeys.add(key);
        commonToSelect.push(commonMatch);
      }
      return;
    }

    if (otherKeys.has(key)) {
      duplicates.push(value);
      return;
    }

    otherKeys.add(key);
    otherList.push(value);
  });

  if (commonToSelect.length > 0) {
    setProfile((current) => ({
      ...current,
      languages: dedupeLanguages([...(current.languages || []), ...commonToSelect]),
    }));
  }
  setOtherLanguages(otherList.join(', '));
  setNewOtherLanguage('');
  setSuccess('');
  setError(
    duplicates.length > 0
      ? `${duplicates.map((item) => `"${item}"`).join(', ')} ${duplicates.length === 1 ? 'is' : 'are'} already added.`
      : ''
  );
};

const removeOtherLanguage = (language) => {
  setOtherLanguages(
    splitOtherLanguages(otherLanguages).filter((item) => item !== language).join(', ')
  );
  setSuccess('');
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
    if (loadError || !profile.id) {
      setError(PROFILE_LOAD_ERROR);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { supabase } = await import('../lib/supabase.js');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== profile.id) {
        throw new Error('Your session has changed. Please sign in again.');
      }

      const payload = {
        full_name: profile.full_name,
        ic_number: profile.ic_number,
        phone: profile.phone,
        languages: buildLanguagesArray(profile.languages, otherLanguages),
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
                {profile.membership_status || 'Unknown'}
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
              <select
                value=""
                onChange={(event) => {
                if (event.target.value) handleLanguageToggle(event.target.value);
                }}
                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
              >
              <option value="">Select a language...</option>
                {COMMON_LANGUAGE_OPTIONS.filter(
                (language) =>
                  !(profile.languages || []).some(
                  (item) => normalizeLanguageValue(item) === normalizeLanguageValue(language)
                  )).map((language) => (
              <option key={language} value={language}>
              {language}
              </option>
              ))}
              </select>

            <div className="mt-3 flex gap-2">
              <input
              type="text"
              value={newOtherLanguage}
              onChange={(event) => setNewOtherLanguage(event.target.value)}
              onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addOtherLanguage();
              }
            }}
            placeholder="Not in the list? Type it here"
            className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
            />
            <button
            type="button"
            onClick={addOtherLanguage}
            className="min-h-[48px] rounded-xl border-2 border-slate-700 bg-slate-900 px-4 text-sm font-bold text-white"
            >
            Add
            </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
            {(profile.languages || []).map((language) => (
            <span
            key={language}
            className="flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
            >
            {language}
            <button
              type="button"
              onClick={() => handleLanguageToggle(language)}
              aria-label={`Remove ${language}`}
              className="text-base leading-none"
            >
            ×
            </button>
            </span>
            ))}

          {splitOtherLanguages(otherLanguages).map((language) => (
          <span
          key={language}
          className="flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
          >
          {language}
          <button
          type="button"
          onClick={() => removeOtherLanguage(language)}
          aria-label={`Remove ${language}`}
          className="text-base leading-none"
        >
          ×
          </button>
              </span>
              ))}
              </div>
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
                <p className="mt-2 text-sm font-bold uppercase text-slate-900">{profile.membership_status || 'Unknown'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Expiry</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{formatDate(profile.membership_expiry)}</p>
              </div>
            </div>
          </div>

          {loadError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{loadError}</div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{success}</div>
          ) : null}

          <button
            type="submit"
            disabled={saving || loading || Boolean(loadError) || !profile.id}
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
