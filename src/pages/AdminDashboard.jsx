import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROOF_BUCKET, getCurrentProfile, supabase } from '../lib/supabase.js';

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [reasons, setReasons] = useState({});

  const totalPending = useMemo(() => renewals.length, [renewals.length]);

  useEffect(() => {
    let active = true;

    async function loadAdminScreen() {
      try {
        const currentProfile = await getCurrentProfile();

        if (!currentProfile || currentProfile.role !== 'admin') {
          navigate('/login', { replace: true });
          return;
        }

        if (active) {
          setProfile(currentProfile);
        }

        const { data, error: fetchError } = await supabase
          .from('renewals')
          .select(
            `
              id,
              years,
              proof_path,
              created_at,
              profiles:member_id (
                full_name,
                ic_number,
                membership_expiry
              )
            `
          )
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        if (active) {
          setRenewals(data ?? []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load pending renewals.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAdminScreen();

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleViewReceipt = async (proofPath) => {
    if (!proofPath) {
      setError('No receipt was attached to this renewal.');
      return;
    }

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from(PROOF_BUCKET)
        .createSignedUrl(proofPath, 60);

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err.message || 'Unable to open the payment receipt.');
    }
  };

  const handleApprove = async (renewalId) => {
    setError('');
    setSuccess('');
    setBusyId(renewalId);

    try {
      const { error: approveError } = await supabase.rpc('approve_renewal', {
        p_renewal_id: renewalId,
      });

      if (approveError) {
        throw approveError;
      }

      setSuccess('Renewal approved and membership extended.');
      setRenewals((current) => current.filter((item) => item.id !== renewalId));
    } catch (err) {
      setError(err.message || 'Unable to approve this renewal.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (renewalId) => {
    const reason = (reasons[renewalId] || '').trim();

    if (!reason) {
      setError('Please add a rejection reason before rejecting this renewal.');
      return;
    }

    setError('');
    setSuccess('');
    setBusyId(renewalId);

    try {
      const { error: rejectError } = await supabase.rpc('reject_renewal', {
        p_renewal_id: renewalId,
        p_reason: reason,
      });

      if (rejectError) {
        throw rejectError;
      }

      setSuccess('Renewal rejected with a reason recorded.');
      setRenewals((current) => current.filter((item) => item.id !== renewalId));
      setReasons((current) => ({
        ...current,
        [renewalId]: '',
      }));
    } catch (err) {
      setError(err.message || 'Unable to reject this renewal.');
    } finally {
      setBusyId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign out.');
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f3ea] pb-24 text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">JCNTGA</p>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Admin Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[48px] rounded-xl border-2 border-slate-400 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800"
          >
            Logout
          </button>
        </header>

        {profile ? (
          <div className="mb-5 rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
            <p className="mt-2 text-lg font-extrabold text-slate-900">{profile.full_name || 'Administrator'}</p>
          </div>
        ) : null}

        <div className="mb-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-900">Pending renewals</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{totalPending}</p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-5 text-center text-sm font-semibold text-slate-700 shadow-sm">
            Loading pending renewals...
          </div>
        ) : renewals.length === 0 ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-5 text-center text-base font-semibold text-slate-700 shadow-sm">
            No pending renewals.
          </div>
        ) : (
          <div className="space-y-4">
            {renewals.map((renewal) => {
              const member = renewal.profiles || {};
              const reasonValue = reasons[renewal.id] || '';

              return (
                <article key={renewal.id} className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Member</p>
                      <h2 className="mt-1 text-lg font-extrabold text-slate-900">{member.full_name || 'Unknown member'}</h2>
                    </div>
                    <div className="rounded-full border border-amber-700 bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-amber-900">
                      {renewal.years} year{renewal.years > 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">IC</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{member.ic_number || 'Not set'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Expiry</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(member.membership_expiry)}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Submitted</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(renewal.created_at)}</p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={() => handleViewReceipt(renewal.proof_path)}
                      className="flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-base font-bold text-blue-900"
                    >
                      View Receipt
                    </button>

                    <label className="block text-sm font-semibold text-slate-900">
                      Rejection reason
                      <input
                        type="text"
                        value={reasonValue}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [renewal.id]: event.target.value,
                          }))
                        }
                        placeholder="Required for reject"
                        className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleApprove(renewal.id)}
                        disabled={busyId === renewal.id}
                        className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-700 bg-emerald-100 px-4 py-3 text-base font-bold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {busyId === renewal.id ? 'Working...' : 'Approve'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject(renewal.id)}
                        disabled={busyId === renewal.id}
                        className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-red-700 bg-red-100 px-4 py-3 text-base font-bold text-red-900 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {busyId === renewal.id ? 'Working...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
