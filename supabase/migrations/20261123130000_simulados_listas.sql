-- Simulados (provas cronometradas) e listas de questões.
--
-- Segurança:
--   * O gabarito continua em question_answers (só o dono do curso lê). O aluno
--     só descobre a correta depois de entregar o simulado, via
--     mock_attempt_review(), igual ao answer_question() da prática.
--   * Tentativas, respostas e XP só mudam por funções SECURITY DEFINER.
--   * Questões só entram em simulado ou lista se quem pede pode vê-las
--     (dono do curso ou aluno matriculado).

-- -----------------------------------------------------------------------------
-- XP de simulado
-- -----------------------------------------------------------------------------

-- Lista completa de motivos: inclui 'redacao' (migration 20261123120000_redacao)
-- para que a ordem de merge não derrube nenhum. Quem adicionar um motivo novo
-- depois deve repetir a lista inteira.
alter table public.xp_events drop constraint if exists xp_events_reason_check;
alter table public.xp_events add constraint xp_events_reason_check
  check (reason in ('lesson_completed', 'question_correct', 'redacao', 'mock_exam_completed'));

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

-- Simulado montado pelo professor no Estúdio (questões do próprio curso).
create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 330),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mock_exams_course_idx on public.mock_exams (course_id);

create table public.mock_exam_questions (
  mock_exam_id uuid not null references public.mock_exams (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  position integer not null default 0,
  primary key (mock_exam_id, question_id)
);

-- Uma tentativa de simulado (por filtros ou de um simulado do professor).
create table public.mock_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mock_exam_id uuid references public.mock_exams (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  filters jsonb not null default '{}',
  duration_minutes integer not null check (duration_minutes between 1 and 330),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  total_count integer not null default 0,
  correct_count integer,
  xp_gained integer not null default 0,
  bonus_xp integer not null default 0
);
create index mock_attempts_user_idx on public.mock_attempts (user_id, started_at desc);

create table public.mock_attempt_items (
  attempt_id uuid not null references public.mock_attempts (id) on delete cascade,
  position integer not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  option_id uuid references public.question_options (id) on delete set null,
  is_correct boolean,
  answered_at timestamptz,
  primary key (attempt_id, position),
  unique (attempt_id, question_id)
);

-- Lista de questões (de professor ou aluno), para estudar ou imprimir.
create table public.question_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index question_lists_owner_idx on public.question_lists (owner_id, updated_at desc);

create table public.question_list_items (
  list_id uuid not null references public.question_lists (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  position integer not null default 0,
  primary key (list_id, question_id)
);

create trigger mock_exams_touch before update on public.mock_exams
  for each row execute function public.touch_updated_at();
create trigger question_lists_touch before update on public.question_lists
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Quem pode ver as questões do curso (mesma regra da policy de questions).
create function public.can_read_course_questions(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_course_owner(p_course) or public.is_enrolled(p_course);
$$;

create function public.owns_question_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.question_lists l where l.id = p_list and l.owner_id = (select auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.mock_exams enable row level security;
alter table public.mock_exam_questions enable row level security;
alter table public.mock_attempts enable row level security;
alter table public.mock_attempt_items enable row level security;
alter table public.question_lists enable row level security;
alter table public.question_list_items enable row level security;

-- Simulados do professor: o dono edita; alunos matriculados veem os publicados.
create policy "mock_exams: owner or enrolled when published" on public.mock_exams
  for select to authenticated
  using (public.is_course_owner(course_id) or (status = 'published' and public.is_enrolled(course_id)));
create policy "mock_exams: owner writes" on public.mock_exams
  for all to authenticated
  using (public.is_course_owner(course_id)) with check (public.is_course_owner(course_id));

create policy "mock_exam_questions: read with exam" on public.mock_exam_questions
  for select to authenticated
  using (exists (
    select 1 from public.mock_exams e
    where e.id = mock_exam_id
      and (public.is_course_owner(e.course_id) or (e.status = 'published' and public.is_enrolled(e.course_id)))
  ));
-- Só questões do mesmo curso do simulado.
create policy "mock_exam_questions: owner writes same-course questions" on public.mock_exam_questions
  for all to authenticated
  using (exists (select 1 from public.mock_exams e where e.id = mock_exam_id and public.is_course_owner(e.course_id)))
  with check (exists (
    select 1 from public.mock_exams e
    join public.questions q on q.id = question_id and q.course_id = e.course_id
    where e.id = mock_exam_id and public.is_course_owner(e.course_id)
  ));

-- Tentativas: cada um lê só as suas. Escrita só pelas funções abaixo.
create policy "mock_attempts: read own" on public.mock_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mock_attempt_items: read own" on public.mock_attempt_items
  for select to authenticated
  using (exists (select 1 from public.mock_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

-- Listas: privadas de quem criou.
create policy "question_lists: owner all" on public.question_lists
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "question_list_items: read own lists" on public.question_list_items
  for select to authenticated using (public.owns_question_list(list_id));
create policy "question_list_items: delete own lists" on public.question_list_items
  for delete to authenticated using (public.owns_question_list(list_id));
create policy "question_list_items: add visible questions" on public.question_list_items
  for insert to authenticated
  with check (
    public.owns_question_list(list_id)
    and exists (select 1 from public.questions q where q.id = question_id and public.can_read_course_questions(q.course_id))
  );
create policy "question_list_items: reorder own lists" on public.question_list_items
  for update to authenticated
  using (public.owns_question_list(list_id))
  with check (
    public.owns_question_list(list_id)
    and exists (select 1 from public.questions q where q.id = question_id and public.can_read_course_questions(q.course_id))
  );

-- -----------------------------------------------------------------------------
-- Sorteio de questões
-- -----------------------------------------------------------------------------

-- Interna: questões que p_uid pode ver, filtradas. Só entram questões com
-- gabarito e pelo menos 2 alternativas.
create function public.question_pool(
  p_uid uuid,
  p_subjects text[],
  p_areas text[],
  p_levels smallint[],
  p_course uuid
)
returns table (question_id uuid, course_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.course_id
  from public.questions q
  join public.courses c on c.id = q.course_id
  where (c.owner_id = p_uid
         or exists (select 1 from public.enrollments e where e.course_id = c.id and e.user_id = p_uid))
    and (p_course is null or c.id = p_course)
    and (coalesce(cardinality(p_subjects), 0) = 0 or c.subject = any (p_subjects))
    and (coalesce(cardinality(p_areas), 0) = 0 or public.subject_area(c.subject) = any (p_areas))
    and (coalesce(cardinality(p_levels), 0) = 0 or c.level = any (p_levels))
    and exists (select 1 from public.question_answers a where a.question_id = q.id)
    and (select count(*) from public.question_options o where o.question_id = q.id) >= 2;
$$;
revoke all on function public.question_pool(uuid, text[], text[], smallint[], uuid) from public, anon, authenticated;

-- Sorteia até p_count questões visíveis para quem chama (usado pelas listas).
create function public.pick_questions(
  p_subjects text[] default null,
  p_areas text[] default null,
  p_levels smallint[] default null,
  p_course uuid default null,
  p_count integer default 10,
  p_exclude uuid[] default null
)
returns setof uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return query
    select p.question_id
    from public.question_pool(v_uid, p_subjects, p_areas, p_levels, p_course) p
    where p_exclude is null or not (p.question_id = any (p_exclude))
    order by random()
    limit least(greatest(coalesce(p_count, 10), 1), 100);
end;
$$;

-- -----------------------------------------------------------------------------
-- Simulados: começar, responder, entregar, revisar
-- -----------------------------------------------------------------------------

-- Simulado por filtros. p_minutes nulo = 3 min por questão (ritmo do ENEM).
create function public.start_mock_exam(
  p_subjects text[] default null,
  p_areas text[] default null,
  p_levels smallint[] default null,
  p_count integer default 10,
  p_minutes integer default null,
  p_title text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := coalesce(p_count, 10);
  v_minutes integer;
  v_attempt uuid;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_count < 1 or v_count > 90 then
    raise exception 'invalid_count' using errcode = '22023';
  end if;
  v_minutes := coalesce(p_minutes, v_count * 3);
  if v_minutes < 1 or v_minutes > 330 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;

  insert into public.mock_attempts (user_id, title, filters, duration_minutes, deadline_at)
  values (
    v_uid,
    coalesce(nullif(left(trim(p_title), 160), ''), 'Simulado'),
    jsonb_build_object('subjects', coalesce(p_subjects, '{}'), 'areas', coalesce(p_areas, '{}'),
                       'levels', coalesce(p_levels, '{}'), 'count', v_count),
    v_minutes,
    now() + make_interval(mins => v_minutes)
  )
  returning id into v_attempt;

  with picked as (
    select p.question_id, p.course_id
    from public.question_pool(v_uid, p_subjects, p_areas, p_levels, null) p
    order by random()
    limit v_count
  )
  insert into public.mock_attempt_items (attempt_id, position, question_id, course_id)
  select v_attempt, (row_number() over ())::integer - 1, question_id, course_id from picked;
  get diagnostics v_total = row_count;

  if v_total = 0 then
    raise exception 'no_questions' using errcode = 'P0002';
  end if;
  -- Banco com menos questões que o pedido: o tempo encolhe na mesma proporção.
  if v_total < v_count then
    v_minutes := greatest(1, ceil(v_minutes::numeric * v_total / v_count)::integer);
  end if;
  update public.mock_attempts a
  set total_count = v_total, duration_minutes = v_minutes, deadline_at = a.started_at + make_interval(mins => v_minutes)
  where a.id = v_attempt;
  return v_attempt;
end;
$$;

-- Simulado montado pelo professor.
create function public.start_course_mock_exam(p_exam uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.mock_exams%rowtype;
  v_attempt uuid;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_exam from public.mock_exams where id = p_exam;
  if v_exam.id is null then
    raise exception 'exam_not_found' using errcode = 'P0002';
  end if;
  if not (public.is_course_owner(v_exam.course_id)
          or (v_exam.status = 'published' and public.is_enrolled(v_exam.course_id))) then
    raise exception 'not_enrolled' using errcode = '42501';
  end if;

  insert into public.mock_attempts (user_id, mock_exam_id, title, duration_minutes, deadline_at)
  values (v_uid, v_exam.id, v_exam.title, v_exam.duration_minutes, now() + make_interval(mins => v_exam.duration_minutes))
  returning id into v_attempt;

  insert into public.mock_attempt_items (attempt_id, position, question_id, course_id)
  select v_attempt, (row_number() over (order by mq.position, mq.question_id))::integer - 1, q.id, q.course_id
  from public.mock_exam_questions mq
  join public.questions q on q.id = mq.question_id and q.course_id = v_exam.course_id
  where mq.mock_exam_id = v_exam.id;
  get diagnostics v_total = row_count;

  if v_total = 0 then
    raise exception 'no_questions' using errcode = 'P0002';
  end if;
  update public.mock_attempts set total_count = v_total where id = v_attempt;
  return v_attempt;
end;
$$;

-- Salva (ou limpa, com p_option nulo) a resposta de uma questão enquanto o
-- simulado está aberto. 30s de tolerância depois do prazo para a última rede.
create function public.save_mock_answer(p_attempt uuid, p_question uuid, p_option uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_att public.mock_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_att from public.mock_attempts where id = p_attempt and user_id = v_uid;
  if v_att.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;
  if v_att.submitted_at is not null then
    raise exception 'already_submitted' using errcode = '22023';
  end if;
  if now() > v_att.deadline_at + interval '30 seconds' then
    raise exception 'time_over' using errcode = '22023';
  end if;
  if p_option is not null and not exists (
    select 1 from public.question_options o where o.id = p_option and o.question_id = p_question
  ) then
    raise exception 'invalid_option' using errcode = '22023';
  end if;

  update public.mock_attempt_items
  set option_id = p_option, answered_at = case when p_option is null then null else now() end
  where attempt_id = p_attempt and question_id = p_question;
  if not found then
    raise exception 'question_not_in_attempt' using errcode = '22023';
  end if;
end;
$$;

-- Entrega: corrige pelo gabarito, registra as respostas na prática (contam
-- para conquistas) e dá XP. Idempotente: entregar de novo devolve o resultado.
-- XP = XP de cada questão acertada pela primeira vez (mesma regra da prática)
--    + 10 de bônus pelo primeiro simulado de 5+ questões entregue no dia.
create function public.submit_mock_exam(p_attempt uuid)
returns table (correct_count integer, total_count integer, xp_gained integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_att public.mock_attempts%rowtype;
  v_correct integer;
  v_xp integer;
  v_bonus integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_att from public.mock_attempts a where a.id = p_attempt and a.user_id = v_uid for update;
  if v_att.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;
  if v_att.submitted_at is not null then
    return query select v_att.correct_count, v_att.total_count, v_att.xp_gained;
    return;
  end if;

  update public.mock_attempt_items i
  set is_correct = (i.option_id is not null and i.option_id = a.correct_option_id)
  from public.question_answers a
  where i.attempt_id = p_attempt and a.question_id = i.question_id;
  update public.mock_attempt_items i set is_correct = false
  where i.attempt_id = p_attempt and i.is_correct is null;

  select count(*) filter (where i.is_correct) into v_correct
  from public.mock_attempt_items i where i.attempt_id = p_attempt;

  -- XP só pelas questões que a pessoa nunca tinha acertado (calculado antes
  -- de registrar as tentativas abaixo).
  select coalesce(sum(q.xp_reward), 0) into v_xp
  from public.mock_attempt_items i
  join public.questions q on q.id = i.question_id
  where i.attempt_id = p_attempt and i.is_correct
    and not exists (
      select 1 from public.question_attempts t
      where t.user_id = v_uid and t.question_id = i.question_id and t.is_correct
    );

  if v_att.total_count >= 5 and not exists (
    select 1 from public.mock_attempts o
    where o.user_id = v_uid and o.id <> p_attempt and o.bonus_xp > 0
      and o.submitted_at >= date_trunc('day', now())
  ) then
    v_bonus := 10;
  end if;

  insert into public.question_attempts (user_id, question_id, course_id, option_id, is_correct)
  select v_uid, i.question_id, i.course_id, i.option_id, i.is_correct
  from public.mock_attempt_items i
  where i.attempt_id = p_attempt and i.option_id is not null
  order by i.position;

  update public.mock_attempts a
  set submitted_at = now(), correct_count = v_correct, xp_gained = v_xp + v_bonus, bonus_xp = v_bonus
  where a.id = p_attempt;

  perform public.award_xp(v_uid, v_xp + v_bonus, 'mock_exam_completed', p_attempt);

  return query select v_correct, v_att.total_count, v_xp + v_bonus;
end;
$$;

-- Revisão com gabarito: só da própria tentativa e só depois de entregue.
create function public.mock_attempt_review(p_attempt uuid)
returns table (
  "position" integer,
  question_id uuid,
  course_id uuid,
  subject text,
  area text,
  option_id uuid,
  correct_option_id uuid,
  is_correct boolean,
  explanation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_submitted timestamptz;
  v_found boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select true, a.submitted_at into v_found, v_submitted
  from public.mock_attempts a where a.id = p_attempt and a.user_id = v_uid;
  if v_found is null then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;
  if v_submitted is null then
    raise exception 'not_submitted' using errcode = '42501';
  end if;
  return query
    select i.position, i.question_id, i.course_id, c.subject, public.subject_area(c.subject),
           i.option_id, ans.correct_option_id, coalesce(i.is_correct, false), q.explanation
    from public.mock_attempt_items i
    join public.questions q on q.id = i.question_id
    join public.courses c on c.id = i.course_id
    left join public.question_answers ans on ans.question_id = i.question_id
    where i.attempt_id = p_attempt
    order by i.position;
end;
$$;

revoke all on function public.can_read_course_questions(uuid) from public, anon;
revoke all on function public.owns_question_list(uuid) from public, anon;
revoke all on function public.pick_questions(text[], text[], smallint[], uuid, integer, uuid[]) from public, anon;
revoke all on function public.start_mock_exam(text[], text[], smallint[], integer, integer, text) from public, anon;
revoke all on function public.start_course_mock_exam(uuid) from public, anon;
revoke all on function public.save_mock_answer(uuid, uuid, uuid) from public, anon;
revoke all on function public.submit_mock_exam(uuid) from public, anon;
revoke all on function public.mock_attempt_review(uuid) from public, anon;
grant execute on function public.can_read_course_questions(uuid) to authenticated;
grant execute on function public.owns_question_list(uuid) to authenticated;
grant execute on function public.pick_questions(text[], text[], smallint[], uuid, integer, uuid[]) to authenticated;
grant execute on function public.start_mock_exam(text[], text[], smallint[], integer, integer, text) to authenticated;
grant execute on function public.start_course_mock_exam(uuid) to authenticated;
grant execute on function public.save_mock_answer(uuid, uuid, uuid) to authenticated;
grant execute on function public.submit_mock_exam(uuid) to authenticated;
grant execute on function public.mock_attempt_review(uuid) to authenticated;
