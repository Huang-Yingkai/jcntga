\set ON_ERROR_STOP on

-- The Sprint 1 suite creates these fictional admin and member accounts.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

insert into public.courses (title, starts_at, seat_limit)
values ('Last seat test', now() + interval '1 day', 1),
       ('Booking retry test', now() + interval '1 day', 1);

do $$
begin
  begin
    insert into public.courses (title, starts_at, seat_limit) values ('Invalid cap', now(), 0);
    raise exception 'Zero seat limit was accepted';
  exception when check_violation then null;
  end;
end;
$$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    insert into public.courses (title, starts_at, seat_limit) values ('Member course', now(), 1);
    raise exception 'Member was allowed to create a course';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set request.jwt.claim.sub = '';
set role anon;

do $$
declare
  course_id uuid := (select id from public.courses where title = 'Booking retry test');
  registration_id constant uuid := '00000000-0000-0000-0000-000000000010';
  guest_details constant jsonb := '{"a":"1","b":"2","c":"3","d":"4","e":"5"}';
begin
  if course_id is null then
    raise exception 'Guest could not read course';
  end if;

  begin
    perform public.book_course_seat(course_id, registration_id, '{}');
    raise exception 'Incomplete checkout was accepted';
  exception when invalid_parameter_value then null;
  end;

  if public.book_course_seat(course_id, registration_id, guest_details) is distinct from registration_id
     or public.book_course_seat(course_id, registration_id, guest_details) is distinct from registration_id then
    raise exception 'Booking retry did not return the original registration';
  end if;

  begin
    perform public.book_course_seat(course_id, gen_random_uuid(), guest_details);
    raise exception 'Full course accepted another booking';
  exception when raise_exception then
    if sqlerrm <> 'COURSE_FULL' then raise; end if;
  end;

  begin
    perform 1 from public.course_registrations;
    raise exception 'Guest could read private registrations';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.course_registrations) <> 1
     or (select booked_seats from public.courses where title = 'Booking retry test') <> 1 then
    raise exception 'Retry created another registration or changed the seat count';
  end if;
end;
$$;

\echo PASS: admin course creation, guest checkout, retry, seat limit, and registration privacy
