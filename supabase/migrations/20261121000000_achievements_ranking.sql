-- Conquistas (emblemas), perfil público e ranking geral.
--
-- Conquistas só são concedidas pelo banco: check_achievements() roda em
-- gatilhos das tabelas que complete_lesson, answer_question e enroll_free
-- alimentam. Nenhum cliente tem permissão de escrever em user_achievements.

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.achievements (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null check (char_length(description) <= 200),
  icon text not null default 'medal' check (char_length(icon) <= 40),
  position integer not null default 0
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_slug text not null references public.achievements (slug) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_slug)
);
create index user_achievements_slug_idx on public.user_achievements (achievement_slug);

insert into public.achievements (slug, name, description, icon, position) values
  ('calouro',           'Calouro',           'Criou a conta no Curso On.',                                          'cap',      1),
  ('primeira-aula',     'Primeira Aula',     'Concluiu a primeira aula.',                                           'play',     2),
  ('maratonista',       'Maratonista',       'Concluiu 25 aulas.',                                                  'runner',   3),
  ('na-mosca',          'Na Mosca',          'Acertou a primeira questão.',                                         'target',   4),
  ('artilheiro',        'Artilheiro',        'Acertou 100 questões diferentes.',                                    'ball',     5),
  ('gabarito',          'Gabarito',          'Acertou 10 questões seguidas.',                                       'check',    6),
  ('sequencia-de-fogo', 'Sequência de Fogo', 'Estudou 7 dias seguidos.',                                            'flame',    7),
  ('imparavel',         'Imparável',         'Estudou 30 dias seguidos.',                                           'bolt',     8),
  ('curso-zerado',      'Curso Zerado',      'Concluiu todas as aulas de um curso.',                                'trophy',   9),
  ('sobe-de-nivel',     'Sobe de Nível',     'Zerou o nível 1 de uma matéria e começou o nível 2.',                 'stairs',  10),
  ('polimata',          'Polímata',          'Concluiu aulas nas 4 áreas do ENEM.',                                 'compass', 11),
  ('podio',             'Pódio',             'Ficou entre os 3 primeiros no ranking de um curso com 3+ alunos.',   'podium',  12);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- Catálogo e emblemas conquistados são públicos (aparecem no card do aluno).
create policy "achievements: public read" on public.achievements
  for select to anon, authenticated using (true);
create policy "user_achievements: public read" on public.user_achievements
  for select to anon, authenticated using (true);
-- Sem policies de insert/update/delete: só check_achievements() escreve.

-- -----------------------------------------------------------------------------
-- Regras
-- -----------------------------------------------------------------------------

-- Área do ENEM de cada matéria (mesmas chaves de content/subjects.json).
create function public.subject_area(p_subject text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_subject in ('portugues', 'literatura', 'redacao', 'ingles', 'espanhol') then 'linguagens'
    when p_subject in ('historia', 'geografia', 'filosofia', 'sociologia') then 'humanas'
    when p_subject in ('biologia', 'quimica', 'fisica') then 'natureza'
    when p_subject = 'matematica' then 'matematica'
  end;
$$;

-- Interna: confere todas as regras e concede o que faltar. Idempotente.
create function public.check_achievements(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lessons integer;
  v_streak integer;
  v_earned text[] := array['calouro'];
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;

  select count(*) into v_lessons from public.lesson_progress where user_id = p_user;
  if v_lessons >= 1 then v_earned := array_append(v_earned, 'primeira-aula'); end if;
  if v_lessons >= 25 then v_earned := array_append(v_earned, 'maratonista'); end if;

  if exists (select 1 from public.question_attempts where user_id = p_user and is_correct) then
    v_earned := array_append(v_earned, 'na-mosca');
  end if;
  if (select count(distinct question_id) from public.question_attempts where user_id = p_user and is_correct) >= 100 then
    v_earned := array_append(v_earned, 'artilheiro');
  end if;
  -- 10 acertos seguidos: as 10 últimas respostas, todas certas.
  if (
    select count(*) filter (where t.is_correct) = 10
    from (
      select a.is_correct from public.question_attempts a
      where a.user_id = p_user
      order by a.created_at desc, a.id desc
      limit 10
    ) t
  ) then
    v_earned := array_append(v_earned, 'gabarito');
  end if;

  select streak_days into v_streak from public.profiles where id = p_user;
  if v_streak >= 7 then v_earned := array_append(v_earned, 'sequencia-de-fogo'); end if;
  if v_streak >= 30 then v_earned := array_append(v_earned, 'imparavel'); end if;

  -- Cursos que o aluno zerou (todas as aulas concluídas).
  if exists (
    select 1
    from public.lessons l
    left join public.lesson_progress p on p.lesson_id = l.id and p.user_id = p_user
    group by l.course_id
    having count(*) > 0 and count(*) = count(p.lesson_id)
  ) then
    v_earned := array_append(v_earned, 'curso-zerado');
  end if;

  -- Zerou um nível 1 e está matriculado no nível 2 da mesma matéria.
  if exists (
    select 1
    from (
      select l.course_id
      from public.lessons l
      left join public.lesson_progress p on p.lesson_id = l.id and p.user_id = p_user
      group by l.course_id
      having count(*) > 0 and count(*) = count(p.lesson_id)
    ) done
    join public.courses c1 on c1.id = done.course_id and c1.level = 1
    join public.courses c2 on c2.subject = c1.subject and c2.level = 2
    join public.enrollments e on e.course_id = c2.id and e.user_id = p_user
  ) then
    v_earned := array_append(v_earned, 'sobe-de-nivel');
  end if;

  if (
    select count(distinct public.subject_area(c.subject))
    from public.lesson_progress p
    join public.courses c on c.id = p.course_id
    where p.user_id = p_user and c.subject is not null
  ) = 4 then
    v_earned := array_append(v_earned, 'polimata');
  end if;

  -- Top 3 (com XP) em algum curso que tenha pelo menos 3 alunos matriculados.
  if exists (
    with mine as (
      select e.course_id from public.enrollments e
      where e.user_id = p_user
        and (select count(*) from public.enrollments e2 where e2.course_id = e.course_id) >= 3
    ),
    scores as (
      select m.course_id, x.user_id, sum(x.amount) as xp
      from mine m
      join public.xp_events x on x.ref_id in (
        select l.id from public.lessons l where l.course_id = m.course_id
        union all
        select q.id from public.questions q where q.course_id = m.course_id
      )
      join public.enrollments e on e.course_id = m.course_id and e.user_id = x.user_id
      group by m.course_id, x.user_id
    ),
    ranked as (
      select course_id, user_id, rank() over (partition by course_id order by xp desc) as pos
      from scores where xp > 0
    )
    select 1 from ranked where user_id = p_user and pos <= 3
  ) then
    v_earned := array_append(v_earned, 'podio');
  end if;

  insert into public.user_achievements (user_id, achievement_slug)
  select p_user, s from unnest(v_earned) as s
  on conflict do nothing;
end;
$$;
revoke all on function public.check_achievements(uuid) from public, anon, authenticated;

-- Gatilhos: rodam depois de cada ação que pode liberar uma conquista.
create function public.achievements_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    perform public.check_achievements(new.id);
  else
    perform public.check_achievements(new.user_id);
  end if;
  return null;
end;
$$;
revoke all on function public.achievements_after_change() from public, anon, authenticated;

create trigger achievements_on_profile_insert after insert on public.profiles
  for each row execute function public.achievements_after_change();
create trigger achievements_on_profile_progress after update of xp, streak_days on public.profiles
  for each row execute function public.achievements_after_change();
create trigger achievements_on_lesson after insert on public.lesson_progress
  for each row execute function public.achievements_after_change();
create trigger achievements_on_answer after insert on public.question_attempts
  for each row execute function public.achievements_after_change();
create trigger achievements_on_enroll after insert on public.enrollments
  for each row execute function public.achievements_after_change();

-- Quem já tinha conta recebe o que já conquistou.
select public.check_achievements(id) from public.profiles;

-- -----------------------------------------------------------------------------
-- Perfil público (/u/[id]): só campos públicos, também para visitantes.
-- -----------------------------------------------------------------------------

create function public.public_profile(p_user uuid)
returns table (id uuid, full_name text, avatar_url text, xp integer, streak_days integer, last_study_date date, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.avatar_url, p.xp, p.streak_days, p.last_study_date, p.created_at
  from public.profiles p where p.id = p_user;
$$;
revoke all on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ranking geral: top N por XP total ou da semana, mais a linha de quem pede.
-- -----------------------------------------------------------------------------

create function public.global_ranking(p_period text default 'all', p_limit integer default 50)
returns table (pos bigint, user_id uuid, full_name text, xp bigint, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_period not in ('all', 'week') then
    raise exception 'invalid_period' using errcode = '22023';
  end if;

  return query
    with scores as (
      select p.id as uid, p.full_name as name,
        case when p_period = 'all' then p.xp::bigint
             else coalesce((
               select sum(x.amount) from public.xp_events x
               where x.user_id = p.id and x.created_at >= date_trunc('week', now())
             ), 0)::bigint
        end as total
      from public.profiles p
    ),
    ranked as (
      select rank() over (order by s.total desc) as r, s.uid, s.name, s.total
      from scores s where s.total > 0
    )
    select r.r, r.uid, r.name, r.total, r.uid = v_uid
    from ranked r
    where r.r <= v_limit or r.uid = v_uid
    order by r.r, r.name;
end;
$$;
revoke all on function public.global_ranking(text, integer) from public, anon;
grant execute on function public.global_ranking(text, integer) to authenticated;
