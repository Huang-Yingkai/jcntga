import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Renew from './pages/Renew';
import AdminDashboard from './pages/AdminDashboard';

function DashboardPreview() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Member portal</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Dashboard preview</h1>
        <p className="mt-3 text-base text-slate-700">This is the member dashboard placeholder while the full dashboard screen is being built.</p>
        <Link to="/login" className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-base font-bold text-blue-900">
          Back to Login
        </Link>
      </div>
    </main>
  );
}

function AdminPreview() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Admin</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Admin dashboard</h1>
        <p className="mt-3 text-base text-slate-700">This route is ready for the admin screen to be added.</p>
        <Link to="/login" className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-blue-800 bg-blue-100 px-4 py-3 text-base font-bold text-blue-900">
          Sign out
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/renew" element={<Renew />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
