import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { supabase, getCurrentProfile } = await import('../lib/supabase.js');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const profile = await getCurrentProfile();

      if (!profile) {
        throw new Error('User profile not found.');
      }

      if (profile.role === 'admin') {
        navigate('/admin');
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3efe7] px-4 py-8 text-slate-900 md:flex md:items-center md:justify-center">
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-slate-300 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.12)] md:p-7">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">JCNTGA</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">Guide Access</h1>
          <p className="mt-2 text-sm text-slate-700">Sign in to continue to your member or admin workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-900">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@jcntga.com"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-900">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" aria-live="polite">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[48px] w-full rounded-xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-base font-bold text-blue-900 transition hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </main>
  );
}
