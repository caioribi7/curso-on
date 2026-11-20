-- Mais 18 conquistas (total 30), com as medalhas em public/achievements/medalhas/<slug>.png.
--
-- check_achievements() original vira check_achievements_base(); a nova
-- check_achievements() chama a base e confere as regras novas. Os gatilhos
-- existentes chamam check_achievements() pelo nome, então passam a valer as 30.

insert into public.achievements (slug, name, description, icon, position) values
  ('coruja',              'Coruja',              'Estudou depois das 23h.',                        'owl',       13),
  ('madrugador',          'Madrugador',          'Estudou antes das 7h.',                          'sunrise',   14),
  ('fim-de-semana',       'Fim de Semana',       'Estudou no sábado e no domingo.',                'calendar',  15),
  ('centuriao',           'Centurião',           'Concluiu 100 aulas.',                            'laurel',    16),
  ('mil-xp',              'Mil XP',              'Juntou 1.000 XP.',                               'star',      17),
  ('dez-mil-xp',          'Dez Mil XP',          'Juntou 10.000 XP.',                              'diamond',   18),
  ('redator',             'Redator',             'Concluiu uma aula de Redação.',                  'pen',       19),
  ('linguagens',          'Linguagens',          'Zerou um curso de Linguagens.',                  'speech',    20),
  ('humanas',             'Humanas',             'Zerou um curso de Humanas.',                     'column',    21),
  ('natureza',            'Natureza',            'Zerou um curso de Ciências da Natureza.',        'leaf',      22),
  ('matematica',          'Matemática',          'Zerou um curso de Matemática.',                  'compass',   23),
  ('professor',           'Professor',           'Publicou o primeiro curso.',                     'board',     24),
  ('mestre-das-questoes', 'Mestre das Questões', 'Criou 50 questões nos seus cursos.',             'bulb',      25),
  ('comunidade',          'Comunidade',          'Tem 10 alunos matriculados nos seus cursos.',    'people',    26),
  ('persistente',         'Persistente',         'Errou uma questão e depois acertou.',            'retry',     27),
  ('relampago',           'Relâmpago',           'Respondeu 50 questões em um dia.',               'stopwatch', 28),
  ('lenda',               'Lenda',               '1º lugar no ranking geral (com 3+ alunos).',     'crown',     29),
  ('explorador',          'Explorador',          'Matriculou-se em 5 cursos.',                     'map',       30);

alter function public.check_achievements(uuid) rename to check_achievements_base;
revoke all on function public.check_achievements_base(uuid) from public, anon, authenticated;

-- Interna: quando o aluno estudou (horário de Brasília).
create function public.study_moments(p_user uuid)
returns table (at timestamp)
language sql
stable
security definer
set search_path = ''
as $$
  select completed_at at time zone 'America/Sao_Paulo' from public.lesson_progress where user_id = p_user
  union all
  select created_at at time zone 'America/Sao_Paulo' from public.question_attempts where user_id = p_user;
$$;
revoke all on function public.study_moments(uuid) from public, anon, authenticated;

create function public.check_achievements(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned text[] := '{}';
  v_xp integer;
  v_lessons integer;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;

  perform public.check_achievements_base(p_user);

  -- Momentos de estudo (aulas concluídas e respostas), no horário de Brasília.
  if exists (select 1 from public.study_moments(p_user) m where extract(hour from m.at) >= 23) then
    v_earned := array_append(v_earned, 'coruja');
  end if;
  if exists (select 1 from public.study_moments(p_user) m where extract(hour from m.at) < 7) then
    v_earned := array_append(v_earned, 'madrugador');
  end if;
  if exists (
    select 1 from public.study_moments(p_user) s
    where extract(isodow from s.at) = 6
      and exists (select 1 from public.study_moments(p_user) d where d.at::date = s.at::date + 1)
  ) then
    v_earned := array_append(v_earned, 'fim-de-semana');
  end if;

  select count(*) into v_lessons from public.lesson_progress where user_id = p_user;
  if v_lessons >= 100 then v_earned := array_append(v_earned, 'centuriao'); end if;

  select xp into v_xp from public.profiles where id = p_user;
  if v_xp >= 1000 then v_earned := array_append(v_earned, 'mil-xp'); end if;
  if v_xp >= 10000 then v_earned := array_append(v_earned, 'dez-mil-xp'); end if;

  if exists (
    select 1 from public.lesson_progress p join public.courses c on c.id = p.course_id
    where p.user_id = p_user and c.subject = 'redacao'
  ) then
    v_earned := array_append(v_earned, 'redator');
  end if;

  -- Áreas do ENEM: cursos zerados (todas as aulas concluídas) por área.
  v_earned := v_earned || array(
    select distinct public.subject_area(c.subject)
    from (
      select l.course_id
      from public.lessons l
      left join public.lesson_progress p on p.lesson_id = l.id and p.user_id = p_user
      group by l.course_id
      having count(*) > 0 and count(*) = count(p.lesson_id)
    ) done
    join public.courses c on c.id = done.course_id
    where public.subject_area(c.subject) is not null
  );

  -- Criador de cursos.
  if exists (select 1 from public.courses where owner_id = p_user and status = 'published') then
    v_earned := array_append(v_earned, 'professor');
  end if;
  if (
    select count(*) from public.questions q join public.courses c on c.id = q.course_id where c.owner_id = p_user
  ) >= 50 then
    v_earned := array_append(v_earned, 'mestre-das-questoes');
  end if;
  if (
    select count(distinct e.user_id)
    from public.enrollments e join public.courses c on c.id = e.course_id
    where c.owner_id = p_user and e.user_id <> p_user
  ) >= 10 then
    v_earned := array_append(v_earned, 'comunidade');
  end if;

  -- Questões.
  if exists (
    select 1 from public.question_attempts w
    join public.question_attempts r
      on r.user_id = w.user_id and r.question_id = w.question_id and r.is_correct and r.created_at > w.created_at
    where w.user_id = p_user and not w.is_correct
  ) then
    v_earned := array_append(v_earned, 'persistente');
  end if;
  if exists (
    select 1 from public.question_attempts where user_id = p_user
    group by (created_at at time zone 'America/Sao_Paulo')::date
    having count(*) >= 50
  ) then
    v_earned := array_append(v_earned, 'relampago');
  end if;

  -- Lenda: 1º do ranking geral, com pelo menos 3 alunos pontuando.
  if v_xp > 0
    and (select count(*) from public.profiles where xp > 0) >= 3
    and not exists (select 1 from public.profiles where xp > v_xp) then
    v_earned := array_append(v_earned, 'lenda');
  end if;

  if (select count(*) from public.enrollments where user_id = p_user) >= 5 then
    v_earned := array_append(v_earned, 'explorador');
  end if;

  insert into public.user_achievements (user_id, achievement_slug)
  select p_user, s from unnest(v_earned) as s
  on conflict do nothing;
end;
$$;
revoke all on function public.check_achievements(uuid) from public, anon, authenticated;

-- Conquistas de quem cria: dono do curso é conferido quando publica, ganha
-- questão nova ou aluno novo.
create function public.achievements_for_course_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'courses' then
    perform public.check_achievements(new.owner_id);
  else
    perform public.check_achievements((select owner_id from public.courses where id = new.course_id));
  end if;
  return null;
end;
$$;
revoke all on function public.achievements_for_course_owner() from public, anon, authenticated;

create trigger achievements_on_course_publish after insert or update of status on public.courses
  for each row when (new.status = 'published') execute function public.achievements_for_course_owner();
create trigger achievements_on_question_owner after insert on public.questions
  for each row execute function public.achievements_for_course_owner();
create trigger achievements_on_enroll_owner after insert on public.enrollments
  for each row execute function public.achievements_for_course_owner();

-- Quem já tinha conta recebe o que já conquistou.
select public.check_achievements(id) from public.profiles;
