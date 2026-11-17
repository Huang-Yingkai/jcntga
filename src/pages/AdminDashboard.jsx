import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROOF_BUCKET, getCurrentProfile, supabase } from '../lib/supabase.js';

const TAB_OPTIONS = ['Pending Renewals', 'Member Directory'];
const STATUS_OPTIONS = ['All', 'active', 'expired', 'pending'];

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

function formatAmount(value) {
  const amount = Number(value ?? 0);
  return `RM ${amount.toFixed(0)}`;
}

function getStatusClasses(status) {
  const normalized = (status || 'pending').toLowerCase();

  if (normalized === 'active') {
    return 'border-emerald-300 bg-emerald-100 text-emerald-900';
  }
  if (normalized === 'pending') {
    return 'border-amber-300 bg-amber-100 text-amber-900';
  }
  return 'border-slate-300 bg-slate-200 text-slate-800';
}

function isExpired(member) {
  const expiryDate = member?.membership_expiry ? new Date(member.membership_expiry) : null;
  if (!expiryDate || Number.isNaN(expiryDate.getTime())) return false;
  return expiryDate < new Date();
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('Pending Renewals');
  const [renewals, setRenewals] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingRenewals, setLoadingRenewals] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewIsPdf, setPreviewIsPdf] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const pendingCount = renewals.length;

  const filteredMembers = useMemo(() => {
    const normalized = memberSearch.trim().toLowerCase();

    return members.filter((member) => {
      const searchMatch =
        !normalized ||
        `${member.full_name || ''}`.toLowerCase().includes(normalized) ||
        `${member.ic_number || ''}`.toLowerCase().includes(normalized) ||
        `${member.phone || ''}`.toLowerCase().includes(normalized);

      const statusValue = member.membership_status || 'pending';
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'active' && statusValue === 'active') ||
        (statusFilter === 'expired' && isExpired(member)) ||
        (statusFilter === 'pending' && statusValue === 'pending');

      return searchMatch && matchesStatus;
    });
  }, [memberSearch, members, statusFilter]);

  async function loadPendingRenewals() {
    try {
      const { data, error: fetchError } = await supabase
        .from('renewals')
        .select(
          `
            id,
            years,
            amount_rm,
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

      setRenewals(data ?? []);
    } catch (err) {
      setError(err.message || 'Unable to load pending renewals.');
    }
  }

  async function loadMembers() {
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setMembers(data ?? []);
    } catch (err) {
      setError(err.message || 'Unable to load member directory.');
    }
  }

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

        await Promise.all([loadPendingRenewals(), loadMembers()]);
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load admin dashboard.');
        }
      } finally {
        if (active) {
          setLoadingRenewals(false);
          setLoadingMembers(false);
        }
      }
    }

    loadAdminScreen();

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign out.');
    }
  };

  const handleViewReceipt = async (renewal) => {
    if (!renewal?.proof_path) {
      setError('No receipt was attached to this renewal.');
      return;
    }

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from(PROOF_BUCKET)
        .createSignedUrl(renewal.proof_path, 60);

      if (signedUrlError) {
        throw signedUrlError;
      }

      const proofPath = renewal?.proof_path || '';
      setPreviewTitle(`${renewal.profiles?.full_name || 'Member'} receipt`);
      setPreviewUrl(data?.signedUrl || '');
      setPreviewIsPdf(/\.pdf$/i.test(proofPath));
    } catch (err) {
      setError(err.message || 'Unable to load the payment receipt.');
    }
  };

  const handleApprove = async (renewal) => {
    setError('');
    setSuccess('');
    setBusyId(renewal.id);

    try {
      const { error: approveError } = await supabase.rpc('approve_renewal', {
        p_renewal_id: renewal.id,
      });

      if (approveError) {
        throw approveError;
      }

      setSuccess(`Approved ${renewal.profiles?.full_name || 'member'} renewal.`);
      await Promise.all([loadPendingRenewals(), loadMembers()]);
    } catch (err) {
      setError(err.message || 'Unable to approve this renewal.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (renewal) => {
    const reason = window.prompt('Enter a reason for rejecting this renewal request:');

    if (!reason || !reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }

    setError('');
    setSuccess('');
    setBusyId(renewal.id);

    try {
      const { error: rejectError } = await supabase.rpc('reject_renewal', {
        p_renewal_id: renewal.id,
        p_reason: reason.trim(),
      });

      if (rejectError) {
        throw rejectError;
      }

      setSuccess(`Rejected ${renewal.profiles?.full_name || 'member'} renewal.`);
      await Promise.all([loadPendingRenewals(), loadMembers()]);
    } catch (err) {
      setError(err.message || 'Unable to reject this renewal.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5efe7] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">JCNTGA</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">Admin</h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[44px] rounded-xl border-2 border-white bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {profile ? (
          <div className="mb-6 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
                <p className="mt-2 text-xl font-extrabold text-slate-900">{profile.full_name || 'Administrator'}</p>
              </div>
              <div className="min-h-[44px] rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">
                {pendingCount} pending renewals
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-6 grid w-full gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm md:grid-cols-2">
          {TAB_OPTIONS.map((tab) => {
            const isActive = activeTab === tab;
            const tabCount = tab === 'Pending Renewals' ? pendingCount : members.length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  'min-h-[52px] rounded-xl border-2 px-4 py-3 text-left font-bold transition',
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{tab}</span>
                  <span
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-black',
                      isActive ? 'bg-white text-slate-900' : 'bg-slate-200 text-slate-800',
                    ].join(' ')}
                  >
                    {tabCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        {activeTab === 'Pending Renewals' ? (
          <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            {loadingRenewals ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-base font-semibold text-slate-700">
                Loading pending renewals...
              </div>
            ) : renewals.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-lg font-semibold text-slate-700">
                No pending renewals.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {renewals.map((renewal) => {
                  const member = renewal.profiles || {};
                  const requestedAmount = formatAmount(renewal.amount_rm ?? renewal.years * 100);

                  return (
                    <article key={renewal.id} className="rounded-2xl border border-slate-300 bg-slate-50 p-5">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Member</p>
                          <h2 className="mt-2 text-xl font-extrabold text-slate-900">{member.full_name || 'Unknown member'}</h2>
                        </div>
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-900">
                          {renewal.years} year{renewal.years > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">IC Number</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">{member.ic_number || 'Not set'}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Membership Expiry</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(member.membership_expiry)}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Requested</p>
                            <p className="mt-2 text-base font-bold text-slate-900">
                              {renewal.years} year{renewal.years > 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Amount</p>
                            <p className="mt-2 text-base font-bold text-slate-900">{requestedAmount}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Submitted</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(renewal.created_at)}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => handleViewReceipt(renewal)}
                          className="min-h-[48px] flex-1 rounded-xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-200"
                        >
                          View Receipt
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApprove(renewal)}
                          disabled={busyId === renewal.id}
                          className="min-h-[48px] flex-1 rounded-xl border-2 border-emerald-700 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {busyId === renewal.id ? 'Working...' : 'Approve'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReject(renewal)}
                          disabled={busyId === renewal.id}
                          className="min-h-[48px] flex-1 rounded-xl border-2 border-red-700 bg-red-100 px-4 py-3 text-sm font-bold text-red-900 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {busyId === renewal.id ? 'Working...' : 'Reject'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <input
                type="text"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search by name, IC, or phone"
                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200 lg:max-w-md"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-[48px] rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'All' ? 'All statuses' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {loadingMembers ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-base font-semibold text-slate-700">
                Loading member directory...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-base font-semibold text-slate-700">
                No members found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                  <thead>
                    <tr className="text-slate-600">
                      <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Full Name</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">IC Number</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Phone</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Languages</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Status</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Expiry</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-[0.12em]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => {
                      const rawStatus = member.membership_status || 'pending';
                      const statusLabel = rawStatus === 'active' ? 'active' : rawStatus === 'pending' ? 'pending' : 'expired';

                      return (
                        <tr key={member.id} className="rounded-xl bg-slate-50 text-slate-900 shadow-sm">
                          <td className="rounded-l-xl border border-r-0 border-slate-200 px-3 py-3 font-semibold">{member.full_name || '—'}</td>
                          <td className="border border-r-0 border-slate-200 px-3 py-3">{member.ic_number || '—'}</td>
                          <td className="border border-r-0 border-slate-200 px-3 py-3">{member.phone || '—'}</td>
                          <td className="border border-r-0 border-slate-200 px-3 py-3">{Array.isArray(member.languages) ? member.languages.join(', ') : '—'}</td>
                          <td className="border border-r-0 border-slate-200 px-3 py-3">
                            <span className={['inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]', getStatusClasses(rawStatus)].join(' ')}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="border border-r-0 border-slate-200 px-3 py-3">{formatDate(member.membership_expiry)}</td>
                          <td className="rounded-r-xl border border-slate-200 px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedMember(member)}
                              className="min-h-[44px] rounded-xl border-2 border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold text-slate-900">{previewTitle}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-blue-700 underline underline-offset-2"
                >
                  Open Receipt in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl('');
                    setPreviewIsPdf(false);
                  }}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {previewIsPdf ? (
                <iframe src={previewUrl} title={previewTitle} className="h-96 w-full rounded border" />
              ) : (
                <img src={previewUrl} alt={previewTitle} className="max-h-[70vh] w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-extrabold text-slate-900">Member Details</h3>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Full Name</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{selectedMember.full_name || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Home Address</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{selectedMember.home_address || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Emergency Contact Name</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{selectedMember.emergency_contact_name || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Emergency Contact Phone</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{selectedMember.emergency_contact_phone || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
