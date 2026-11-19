-- =============================================================================
-- Curso On — schema inicial
-- Princípios de segurança:
--   * RLS ligado em TODAS as tabelas do schema public.
--   * Conteúdo pago (lesson_contents) e gabarito (question_answers) ficam em
--     tabelas separadas, legíveis só por quem tem direito.
--   * Escritas sensíveis (matrícula, XP, progresso, tentativas) só acontecem via
--     funções SECURITY DEFINER com search_path fixo, ou pelo service role
--     (webhook do Stripe). Nenhum cliente consegue se matricular ou se dar XP.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  xp integer not null default 0 check (xp >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_study_date date,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 3 and 120),
  subtitle text not null default '' check (char_length(subtitle) <= 200),
  description text not null default '' check (char_length(description) <= 5000),
  theme_color text not null default '#3B5BFD' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'abacus'
    check (icon in ('abacus', 'book', 'bulb', 'flask', 'globe', 'palette', 'code', 'music', 'chart', 'rocket')),
  price_cents integer not null default 0 check (price_cents >= 0 and price_cents <= 10000000),
  currency text not null default 'brl' check (currency in ('brl', 'usd', 'eur')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_owner_idx on public.courses (owner_id);
create index courses_status_idx on public.courses (status);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  icon text not null default 'blocks'
    check (icon in ('blocks', 'pie', 'percent', 'scale', 'shapes', 'graph', 'book', 'bulb', 'flask', 'globe', 'target', 'trophy')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index modules_course_idx on public.modules (course_id, position);

-- Lesson outline (public for published courses: title, duration, order).
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 500),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 600),
  position integer not null default 0,
  is_preview boolean not null default false,
  xp_reward integer not null default 10 check (xp_reward between 0 and 500),
  created_at timestamptz not null default now()
);
create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id);

-- Gated lesson body (only owner, enrolled students, or free preview).
create table public.lesson_contents (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 50000),
  video_url text check (video_url is null or video_url ~ '^https://'),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  statement text not null check (char_length(statement) between 3 and 4000),
  explanation text not null default '' check (char_length(explanation) <= 4000),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  xp_reward integer not null default 5 check (xp_reward between 0 and 200),
  created_at timestamptz not null default now()
);
create index questions_course_idx on public.questions (course_id);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  position integer not null default 0
);
create index question_options_question_idx on public.question_options (question_id, position);

-- Answer key: owner-only. Students only learn the answer via answer_question().
create table public.question_answers (
  question_id uuid primary key references public.questions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  correct_option_id uuid not null references public.question_options (id) on delete cascade
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  source text not null check (source in ('free', 'stripe', 'manual')),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id);

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress (user_id, course_id);

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  option_id uuid not null references public.question_options (id) on delete cascade,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);
create index question_attempts_user_idx on public.question_attempts (user_id, course_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  amount_cents integer not null,
  currency text not null,
  status text not null check (status in ('paid', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null check (reason in ('lesson_completed', 'question_correct')),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();
create trigger lesson_contents_touch before update on public.lesson_contents
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Helper predicates used by policies
-- -----------------------------------------------------------------------------

create function public.is_course_owner(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and c.owner_id = (select auth.uid())
  );
$$;

create function public.is_enrolled(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.course_id = p_course and e.user_id = (select auth.uid())
  );
$$;

create function public.is_course_published(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c where c.id = p_course and c.status = 'published'
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_contents enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_answers enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.question_attempts enable row level security;
alter table public.payments enable row level security;
alter table public.xp_events enable row level security;

-- profiles: any signed-in user can read names/XP (ranking); users edit only
-- their own name/avatar (column grants below block xp/streak tampering).
create policy "profiles: read when signed in" on public.profiles
  for select to authenticated using (true);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- courses
create policy "courses: read published or own" on public.courses
  for select to anon, authenticated
  using (status = 'published' or owner_id = (select auth.uid()));
create policy "courses: create as owner" on public.courses
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "courses: owner updates" on public.courses
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "courses: owner deletes" on public.courses
  for delete to authenticated using (owner_id = (select auth.uid()));

-- modules
create policy "modules: read if course visible" on public.modules
  for select to anon, authenticated
  using (public.is_course_published(course_id) or public.is_course_owner(course_id));
create policy "modules: owner writes" on public.modules
  for all to authenticated
  using (public.is_course_owner(course_id)) with check (public.is_course_owner(course_id));

-- lessons (outline)
create policy "lessons: read if course visible" on public.lessons
  for select to anon, authenticated
  using (public.is_course_published(course_id) or public.is_course_owner(course_id));
create policy "lessons: owner writes" on public.lessons
  for all to authenticated
  using (public.is_course_owner(course_id)) with check (public.is_course_owner(course_id));

-- lesson_contents (gated)
create policy "lesson_contents: owner, enrolled or preview" on public.lesson_contents
  for select to anon, authenticated
  using (
    public.is_course_owner(course_id)
    or public.is_enrolled(course_id)
    or (
      public.is_course_published(course_id)
      and exists (select 1 from public.lessons l where l.id = lesson_id and l.is_preview)
    )
  );
create policy "lesson_contents: owner writes" on public.lesson_contents
  for all to authenticated
  using (public.is_course_owner(course_id)) with check (public.is_course_owner(course_id));

-- questions + options: owner or enrolled students
create policy "questions: owner or enrolled" on public.questions
  for select to authenticated
  using (public.is_course_owner(course_id) or public.is_enrolled(course_id));
create policy "questions: owner writes" on public.questions
  for all to authenticated
  using (public.is_course_owner(course_id)) with check (public.is_course_owner(course_id));

create policy "question_options: owner or enrolled" on public.question_options
  for select to authenticated
  using (exists (
    select 1 from public.questions q
    where q.id = question_id
      and (public.is_course_owner(q.course_id) or public.is_enrolled(q.course_id))
  ));
create policy "question_options: owner writes" on public.question_options
  for all to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id and public.is_course_owner(q.course_id)))
  with check (exists (select 1 from public.questions q where q.id = question_id and public.is_course_owner(q.course_id)));

-- answer key: owner only
create policy "question_answers: owner only" on public.question_answers
  for all to authenticated
  using (public.is_course_owner(course_id)) with check (public.is_course_owner(course_id));

-- enrollments: students see their own, owners see their course roster.
-- No insert/update/delete policies: only enroll_free() or the service role.
create policy "enrollments: own or course owner" on public.enrollments
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_course_owner(course_id));

-- progress / attempts / payments / xp: read own only. Writes via functions.
create policy "lesson_progress: read own" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "question_attempts: read own" on public.question_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "payments: read own" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "xp_events: read own" on public.xp_events
  for select to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Gamification + enrollment functions
-- -----------------------------------------------------------------------------

-- Internal: never callable by clients.
create function public.award_xp(p_user uuid, p_amount integer, p_reason text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last date;
begin
  if p_amount <= 0 then
    return;
  end if;

  insert into public.xp_events (user_id, amount, reason, ref_id)
  values (p_user, p_amount, p_reason, p_ref);

  select last_study_date into v_last from public.profiles where id = p_user for update;

  update public.profiles
  set xp = xp + p_amount,
      streak_days = case
        when v_last = current_date then streak_days
        when v_last = current_date - 1 then streak_days + 1
        else 1
      end,
      last_study_date = current_date
  where id = p_user;
end;
$$;
revoke all on function public.award_xp(uuid, integer, text, uuid) from public, anon, authenticated;

create function public.enroll_free(p_course uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.courses
    where id = p_course and status = 'published' and price_cents = 0
  ) then
    raise exception 'course_not_free' using errcode = '42501';
  end if;
  insert into public.enrollments (user_id, course_id, source)
  values (v_uid, p_course, 'free')
  on conflict (user_id, course_id) do nothing;
end;
$$;

create function public.complete_lesson(p_lesson uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course uuid;
  v_xp integer;
  v_inserted integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select course_id, xp_reward into v_course, v_xp from public.lessons where id = p_lesson;
  if v_course is null then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_enrolled(v_course) or public.is_course_owner(v_course)) then
    raise exception 'not_enrolled' using errcode = '42501';
  end if;

  insert into public.lesson_progress (user_id, lesson_id, course_id)
  values (v_uid, p_lesson, v_course)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return 0; -- already completed: no double XP
  end if;

  perform public.award_xp(v_uid, v_xp, 'lesson_completed', p_lesson);
  return v_xp;
end;
$$;

create function public.answer_question(p_question uuid, p_option uuid)
returns table (is_correct boolean, correct_option_id uuid, explanation text, xp_gained integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course uuid;
  v_xp integer;
  v_explanation text;
  v_correct uuid;
  v_is_correct boolean;
  v_already boolean;
  v_gain integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select q.course_id, q.xp_reward, q.explanation
    into v_course, v_xp, v_explanation
  from public.questions q where q.id = p_question;
  if v_course is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_enrolled(v_course) or public.is_course_owner(v_course)) then
    raise exception 'not_enrolled' using errcode = '42501';
  end if;
  if not exists (select 1 from public.question_options o where o.id = p_option and o.question_id = p_question) then
    raise exception 'invalid_option' using errcode = '22023';
  end if;

  select a.correct_option_id into v_correct from public.question_answers a where a.question_id = p_question;
  v_is_correct := v_correct is not null and v_correct = p_option;

  select exists (
    select 1 from public.question_attempts t
    where t.user_id = v_uid and t.question_id = p_question and t.is_correct
  ) into v_already;

  insert into public.question_attempts (user_id, question_id, course_id, option_id, is_correct)
  values (v_uid, p_question, v_course, p_option, v_is_correct);

  if v_is_correct and not v_already then
    v_gain := v_xp;
    perform public.award_xp(v_uid, v_xp, 'question_correct', p_question);
  end if;

  return query select v_is_correct, v_correct, v_explanation, v_gain;
end;
$$;

-- Course leaderboard: XP earned inside one course, visible to its members.
create function public.course_leaderboard(p_course uuid, p_limit integer default 10)
returns table (user_id uuid, full_name text, xp bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_enrolled(p_course) or public.is_course_owner(p_course)) then
    raise exception 'not_enrolled' using errcode = '42501';
  end if;
  return query
    select e.user_id, p.full_name, coalesce(sum(x.amount), 0)::bigint as xp
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    left join public.xp_events x
      on x.user_id = e.user_id
     and x.ref_id in (
       select l.id from public.lessons l where l.course_id = p_course
       union all
       select q.id from public.questions q where q.course_id = p_course
     )
    where e.course_id = p_course
    group by e.user_id, p.full_name
    order by xp desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

revoke all on function public.enroll_free(uuid) from public, anon;
revoke all on function public.complete_lesson(uuid) from public, anon;
revoke all on function public.answer_question(uuid, uuid) from public, anon;
revoke all on function public.course_leaderboard(uuid, integer) from public, anon;
grant execute on function public.enroll_free(uuid) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.answer_question(uuid, uuid) to authenticated;
grant execute on function public.course_leaderboard(uuid, integer) to authenticated;
