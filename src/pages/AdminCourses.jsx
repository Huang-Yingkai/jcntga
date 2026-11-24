import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const COURSE_COLUMNS = 'id,title,starts_at,seat_limit,booked_seats';
const FIELD_CLASS = 'min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200';
const COURSE_DATE = new Intl.DateTimeFormat('en-MY', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kuala_Lumpur',
});

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      try {
        const { data, error } = await supabase.from('courses').select(COURSE_COLUMNS).order('starts_at');
        if (error) throw error;
        if (active) setCourses(data);
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to load courses.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCourses();
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const title = values.get('title').trim();
    const seatLimit = Number(values.get('seatLimit'));
    const startsAt = new Date(`${values.get('startsAt')}+08:00`);

    setSubmitError('');
    setSuccess('');

    if (!title || !Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 2147483647 || Number.isNaN(startsAt.getTime())) {
      setSubmitError('Enter a course title, a valid start time, and a positive whole-number seat limit.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('courses')
        .insert({ title, starts_at: startsAt.toISOString(), seat_limit: seatLimit })
        .select(COURSE_COLUMNS)
        .single();
      if (error) throw error;

      setCourses((current) => [...current, data].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)));
      setSuccess(`Created ${data.title}.`);
      form.reset();
    } catch (error) {
      setSubmitError(error.message || 'Unable to create the course.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Course management">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-extrabold">Create Course</h2>
        <fieldset disabled={submitting} className="space-y-4">
          <label className="block space-y-1 text-sm font-bold">
            <span>Course title</span>
            <input name="title" className={FIELD_CLASS} maxLength={150} required />
          </label>
          <label className="block space-y-1 text-sm font-bold">
            <span>Start date and time (Malaysia time)</span>
            <input name="startsAt" type="datetime-local" className={FIELD_CLASS} required />
          </label>
          <label className="block space-y-1 text-sm font-bold">
            <span>Seat limit</span>
            <input name="seatLimit" type="number" min="1" max="2147483647" step="1" className={FIELD_CLASS} required />
          </label>
          <button type="submit" disabled={loading} className="min-h-[48px] rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {submitting ? 'Creating...' : 'Create Course'}
          </button>
        </fieldset>
        {submitError && <p role="alert" className="mt-4 text-sm font-semibold text-red-800">{submitError}</p>}
        {success && <p role="status" className="mt-4 text-sm font-semibold text-emerald-800">{success}</p>}
      </form>

      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-extrabold">Courses</h2>
        {loading && <p role="status">Loading courses...</p>}
        {loadError && <p role="alert" className="text-sm font-semibold text-red-800">{loadError}</p>}
        {!loading && !loadError && courses.length === 0 && <p>No courses yet.</p>}
        {courses.length > 0 && (
          <ul className="space-y-3">
            {courses.map((course) => (
              <li key={course.id} className="rounded-xl border border-slate-300 bg-slate-50 p-3">
                <h3 className="font-bold">{course.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{COURSE_DATE.format(new Date(course.starts_at))} MYT</p>
                <p className="text-sm text-slate-700">{course.booked_seats} of {course.seat_limit} seats booked</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
