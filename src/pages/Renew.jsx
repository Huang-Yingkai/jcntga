import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PROOF_BUCKET, getCurrentProfile, proofPath, supabase } from '../lib/supabase.js';

const YEAR_OPTIONS = [
  { years: 1, amount: 100, label: '1 year', value: 'RM 100' },
  { years: 2, amount: 200, label: '2 years', value: 'RM 200' },
  { years: 3, amount: 300, label: '3 years', value: 'RM 300' },
];

export default function Renew() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [years, setYears] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const currentProfile = await getCurrentProfile();
        if (active) {
          setProfile(currentProfile);
        }
      } catch (err) {
        if (active) {
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const selectedPlan = YEAR_OPTIONS.find((option) => option.years === years) ?? YEAR_OPTIONS[0];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!profile) {
      setError('Your profile is not available yet. Please log in again.');
      return;
    }

    if (!selectedFile) {
      setError('Please choose a payment receipt image before submitting.');
      return;
    }

    setSubmitting(true);

    try {
      const filePath = proofPath(profile.id, selectedFile.name);
      const { error: uploadError } = await supabase.storage
        .from(PROOF_BUCKET)
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedFile.type || 'application/octet-stream',
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await supabase.from('renewals').insert([
        {
          member_id: profile.id,
          years,
          proof_path: filePath,
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      setSuccess(`Renewal request submitted successfully for ${selectedPlan.label}. Payment proof uploaded.`);
      setSelectedFile(null);
      event.target.reset();
    } catch (err) {
      setError(err.message || 'Unable to submit your renewal request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f3ea] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">JCNTGA</p>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Renew Membership</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Membership term</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {YEAR_OPTIONS.map((option) => {
                const isSelected = option.years === years;

                return (
                  <button
                    key={option.years}
                    type="button"
                    onClick={() => setYears(option.years)}
                    className={[
                      'min-h-[56px] rounded-2xl border-2 px-3 py-3 text-left transition',
                      isSelected
                        ? 'border-amber-700 bg-amber-100 text-amber-950 shadow-sm'
                        : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400',
                    ].join(' ')}
                  >
                    <div className="text-base font-extrabold">{option.label}</div>
                    <div className="mt-1 text-sm font-semibold">{`RM ${option.amount}`}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Selected plan</p>
            <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.12em] text-amber-900">Total</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{selectedPlan.value}</p>
                </div>
                <div className="rounded-full border border-amber-700 bg-white px-3 py-2 text-sm font-bold text-amber-900">
                  {selectedPlan.label}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
            <label htmlFor="receipt" className="mb-2 block text-sm font-semibold text-slate-900">
              Upload payment receipt
            </label>
            <input
              id="receipt"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block min-h-[48px] w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-amber-900"
            />
            {selectedFile ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                Selected file: {selectedFile.name}
              </p>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || loadingProfile || !profile}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-base font-bold text-blue-900 transition hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Submitting...' : `Submit Renewal - ${selectedPlan.value}`}
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
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl border-2 border-amber-700 bg-amber-100 text-amber-900"
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
