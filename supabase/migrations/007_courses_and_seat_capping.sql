create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  starts_at timestamptz not null check (isfinite(starts_at)),
  seat_limit integer not null check (seat_limit > 0),
  booked_seats integer not null default 0 check (booked_seats between 0 and seat_limit)
);

create table public.course_registrations (
  id uuid primary key,
  course_id uuid not null references public.courses(id),
  guest_details jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.course_registrations enable row level security;

revoke all on public.courses, public.course_registrations from public, anon, authenticated;
grant select on public.courses to anon, authenticated;
grant insert (title, starts_at, seat_limit) on public.courses to authenticated;

create policy "courses: public reads course details"
  on public.courses for select to anon, authenticated using (true);

create policy "courses: admin creates courses"
  on public.courses for insert to authenticated with check (public.is_admin());

create function public.book_course_seat(
  p_course_id uuid,
  p_registration_id uuid,
  p_guest_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  course public.courses%rowtype;
  existing public.course_registrations%rowtype;
begin
  if p_course_id is null or p_registration_id is null
     or jsonb_typeof(p_guest_details) is distinct from 'object'
     or octet_length(p_guest_details::text) > 8192 then
    raise exception 'INVALID_REGISTRATION' using errcode = '22023';
  end if;

  -- Checkout supplies the field names. Every required value must be a nonblank string.
  if (select count(*) from jsonb_each(p_guest_details)) <> 5
     or exists (
       select 1 from jsonb_each(p_guest_details) as field
       where jsonb_typeof(field.value) <> 'string'
          or field.key !~ '[^[:space:]]'
          or (field.value #>> '{}') !~ '[^[:space:]]'
     ) then
    raise exception 'INVALID_REGISTRATION' using errcode = '22023';
  end if;

  -- Serialize reservations for the same course. The counter and the registration
  -- commit together, so a failed insert cannot consume a seat.
  select * into course from public.courses where id = p_course_id for update;
  if not found then
    raise exception 'COURSE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into existing from public.course_registrations where id = p_registration_id;
  if found then
    if existing.course_id = p_course_id and existing.guest_details = p_guest_details then
      return p_registration_id;
    end if;
    raise exception 'REGISTRATION_ID_CONFLICT' using errcode = '23505';
  end if;

  if course.booked_seats >= course.seat_limit then
    raise exception 'COURSE_FULL' using errcode = 'P0001';
  end if;

  insert into public.course_registrations (id, course_id, guest_details)
  values (p_registration_id, p_course_id, p_guest_details)
  on conflict (id) do nothing;

  if not found then
    raise exception 'REGISTRATION_ID_CONFLICT' using errcode = '23505';
  end if;

  update public.courses set booked_seats = booked_seats + 1 where id = p_course_id;
  return p_registration_id;
end;
$$;

revoke execute on function public.book_course_seat(uuid, uuid, jsonb) from public;
grant execute on function public.book_course_seat(uuid, uuid, jsonb) to anon, authenticated;
