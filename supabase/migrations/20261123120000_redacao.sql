-- Redação: temas do professor, envio do aluno (texto ou foto/PDF) e correção
-- pelas 5 competências do ENEM.
--
-- Segurança:
--   * O aluno só vê as próprias redações; o dono do curso vê as do curso.
--   * Nota e comentários ficam em tabelas separadas, que o aluno só lê depois
--     da devolução (rascunho do professor não vaza).
--   * Nenhum cliente escreve direto em essays/essay_reviews/essay_comments:
--     submit_essay, claim_essay e save_essay_review (SECURITY DEFINER) fazem
--     tudo, inclusive o XP da devolução via award_xp.

-- -----------------------------------------------------------------------------
-- XP: novo motivo 'redacao' (correção devolvida).
-- -----------------------------------------------------------------------------

alter table public.xp_events drop constraint if exists xp_events_reason_check;
alter table public.xp_events
  add constraint xp_events_reason_check
  -- Inclui o motivo dos simulados (20261123130000) para funcionar em qualquer ordem.
  check (reason in ('lesson_completed', 'question_correct', 'redacao', 'mock_exam_completed'));

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create table public.essay_themes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  motivating_text text not null default '' check (char_length(motivating_text) <= 8000),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create index essay_themes_course_idx on public.essay_themes (course_id, created_at desc);

create table public.essays (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.essay_themes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 150),
  body text check (body is null or char_length(body) between 1 and 5000),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_type text check (file_type is null or file_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  status text not null default 'enviada' check (status in ('enviada', 'em_correcao', 'corrigida')),
  corrector_id uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  started_at timestamptz,
  corrected_at timestamptz,
  check (body is not null or file_path is not null),
  check ((file_path is null) = (file_type is null))
);
create index essays_student_idx on public.essays (student_id, submitted_at desc);
create index essays_course_status_idx on public.essays (course_id, status, submitted_at);
create index essays_theme_idx on public.essays (theme_id);

-- Uma nota por competência (0–200, de 40 em 40). Nulo = ainda não avaliada.
create table public.essay_reviews (
  essay_id uuid primary key references public.essays (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  c1 smallint check (c1 in (0, 40, 80, 120, 160, 200)),
  c2 smallint check (c2 in (0, 40, 80, 120, 160, 200)),
  c3 smallint check (c3 in (0, 40, 80, 120, 160, 200)),
  c4 smallint check (c4 in (0, 40, 80, 120, 160, 200)),
  c5 smallint check (c5 in (0, 40, 80, 120, 160, 200)),
  c1_comment text not null default '' check (char_length(c1_comment) <= 2000),
  c2_comment text not null default '' check (char_length(c2_comment) <= 2000),
  c3_comment text not null default '' check (char_length(c3_comment) <= 2000),
  c4_comment text not null default '' check (char_length(c4_comment) <= 2000),
  c5_comment text not null default '' check (char_length(c5_comment) <= 2000),
  final_comment text not null default '' check (char_length(final_comment) <= 4000),
  total smallint generated always as (coalesce(c1, 0) + coalesce(c2, 0) + coalesce(c3, 0) + coalesce(c4, 0) + coalesce(c5, 0)) stored,
  updated_at timestamptz not null default now()
);

-- Comentários no texto: trecho [start_offset, end_offset) do corpo da redação.
-- Sem trecho (null) = comentário geral, usado em redações enviadas por foto/PDF.
create table public.essay_comments (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  start_offset integer check (start_offset is null or start_offset >= 0),
  end_offset integer,
  quote text not null default '' check (char_length(quote) <= 1000),
  body text not null check (char_length(body) between 1 and 1000),
  competency smallint check (competency between 1 and 5),
  position integer not null default 0,
  check ((start_offset is null) = (end_offset is null)),
  check (end_offset is null or end_offset > start_offset)
);
create index essay_comments_essay_idx on public.essay_comments (essay_id, position);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.essay_themes enable row level security;
alter table public.essays enable row level security;
alter table public.essay_reviews enable row level security;
alter table public.essay_comments enable row level security;

-- Temas: abertos de cursos publicados para quem está logado; o dono vê e edita todos.
create policy "essay_themes: read open or own" on public.essay_themes
  for select to authenticated
  using ((is_open and public.is_course_published(course_id)) or public.is_course_owner(course_id));
create policy "essay_themes: owner writes" on public.essay_themes
  for all to authenticated
  using (public.is_course_owner(course_id)) with check (public.is_course_owner(course_id));

-- Redações: o aluno vê as dele; o dono do curso vê as do curso. Escrita só via funções.
create policy "essays: own or course owner" on public.essays
  for select to authenticated
  using (student_id = (select auth.uid()) or public.is_course_owner(course_id));

-- Nota e comentários: o dono do curso sempre; o aluno só depois da devolução.
create policy "essay_reviews: owner or returned to student" on public.essay_reviews
  for select to authenticated
  using (
    public.is_course_owner(course_id)
    or exists (
      select 1 from public.essays e
      where e.id = essay_id and e.student_id = (select auth.uid()) and e.status = 'corrigida'
    )
  );
create policy "essay_comments: owner or returned to student" on public.essay_comments
  for select to authenticated
  using (
    public.is_course_owner(course_id)
    or exists (
      select 1 from public.essays e
      where e.id = essay_id and e.student_id = (select auth.uid()) and e.status = 'corrigida'
    )
  );

-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------

-- Aluno envia uma redação (texto e/ou arquivo já enviado ao bucket "redacoes").
-- Matricula no curso se ainda não estiver (todo curso publicado é grátis).
create function public.submit_essay(
  p_theme uuid,
  p_title text,
  p_body text,
  p_file_path text,
  p_file_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course uuid;
  v_id uuid;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_path text := nullif(btrim(coalesce(p_file_path, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select t.course_id into v_course
  from public.essay_themes t
  join public.courses c on c.id = t.course_id
  where t.id = p_theme and t.is_open and c.status = 'published';
  if v_course is null then
    raise exception 'theme_not_available' using errcode = '42501';
  end if;

  if v_body is null and v_path is null then
    raise exception 'empty_essay' using errcode = '22023';
  end if;
  -- O arquivo precisa estar na pasta do próprio aluno.
  if v_path is not null and split_part(v_path, '/', 1) <> v_uid::text then
    raise exception 'invalid_file' using errcode = '42501';
  end if;

  -- Uma redação por vez em cada tema, até ela ser corrigida.
  if exists (
    select 1 from public.essays e
    where e.student_id = v_uid and e.theme_id = p_theme and e.status <> 'corrigida'
  ) then
    raise exception 'essay_pending' using errcode = '23505';
  end if;

  insert into public.enrollments (user_id, course_id, source)
  values (v_uid, v_course, 'free')
  on conflict (user_id, course_id) do nothing;

  insert into public.essays (theme_id, course_id, student_id, title, body, file_path, file_type)
  values (
    p_theme, v_course, v_uid, left(btrim(coalesce(p_title, '')), 150), v_body, v_path,
    case when v_path is null then null else p_file_type end
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_essay(uuid, text, text, text, text) from public, anon;
grant execute on function public.submit_essay(uuid, text, text, text, text) to authenticated;

-- Professor pega a redação para corrigir: enviada → em correção.
create function public.claim_essay(p_essay uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select course_id into v_course from public.essays where id = p_essay;
  if v_course is null or not public.is_course_owner(v_course) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.essays
  set status = 'em_correcao', corrector_id = v_uid, started_at = now()
  where id = p_essay and status = 'enviada';
end;
$$;
revoke all on function public.claim_essay(uuid) from public, anon;
grant execute on function public.claim_essay(uuid) to authenticated;

-- Professor salva a correção (rascunho) ou devolve ao aluno (p_return).
-- p_scores: [c1..c5] (nulos permitidos no rascunho); p_notes: comentário por
-- competência; p_comments: [{start, end, quote, body, competency}].
create function public.save_essay_review(
  p_essay uuid,
  p_scores integer[],
  p_notes text[],
  p_final text,
  p_comments jsonb,
  p_return boolean default false
)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_essay public.essays%rowtype;
  v_total smallint;
  v_scores integer[] := coalesce(p_scores, array[null, null, null, null, null]::integer[]);
  v_notes text[] := coalesce(p_notes, array['', '', '', '', '']::text[]);
  v_len integer;
  c jsonb;
  i integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_essay from public.essays where id = p_essay for update;
  if v_essay.id is null or not public.is_course_owner(v_essay.course_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_essay.status = 'corrigida' then
    raise exception 'already_returned' using errcode = '22023';
  end if;
  if coalesce(array_length(v_scores, 1), 0) <> 5 or coalesce(array_length(v_notes, 1), 0) <> 5 then
    raise exception 'invalid_scores' using errcode = '22023';
  end if;
  if p_return and exists (select 1 from unnest(v_scores) s where s is null) then
    raise exception 'scores_missing' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_comments, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_comments, '[]'::jsonb)) > 100 then
    raise exception 'invalid_comments' using errcode = '22023';
  end if;

  insert into public.essay_reviews as r (
    essay_id, course_id, c1, c2, c3, c4, c5,
    c1_comment, c2_comment, c3_comment, c4_comment, c5_comment, final_comment, updated_at
  )
  values (
    p_essay, v_essay.course_id, v_scores[1], v_scores[2], v_scores[3], v_scores[4], v_scores[5],
    coalesce(v_notes[1], ''), coalesce(v_notes[2], ''), coalesce(v_notes[3], ''), coalesce(v_notes[4], ''), coalesce(v_notes[5], ''),
    coalesce(p_final, ''), now()
  )
  on conflict (essay_id) do update set
    c1 = excluded.c1, c2 = excluded.c2, c3 = excluded.c3, c4 = excluded.c4, c5 = excluded.c5,
    c1_comment = excluded.c1_comment, c2_comment = excluded.c2_comment, c3_comment = excluded.c3_comment,
    c4_comment = excluded.c4_comment, c5_comment = excluded.c5_comment,
    final_comment = excluded.final_comment, updated_at = now()
  returning r.total into v_total;

  -- Comentários no texto: substitui todos.
  delete from public.essay_comments where essay_id = p_essay;
  v_len := coalesce(char_length(v_essay.body), 0);
  for c in select * from jsonb_array_elements(coalesce(p_comments, '[]'::jsonb)) loop
    if (c ? 'start') and jsonb_typeof(c -> 'start') = 'number' then
      if (c ->> 'start')::integer < 0 or (c ->> 'end')::integer > v_len or (c ->> 'end')::integer <= (c ->> 'start')::integer then
        raise exception 'invalid_comment_range' using errcode = '22023';
      end if;
      insert into public.essay_comments (essay_id, course_id, start_offset, end_offset, quote, body, competency, position)
      values (
        p_essay, v_essay.course_id, (c ->> 'start')::integer, (c ->> 'end')::integer,
        substr(v_essay.body, (c ->> 'start')::integer + 1, least((c ->> 'end')::integer - (c ->> 'start')::integer, 1000)),
        c ->> 'body', nullif(c ->> 'competency', '')::smallint, i
      );
    else
      insert into public.essay_comments (essay_id, course_id, body, competency, position)
      values (p_essay, v_essay.course_id, c ->> 'body', nullif(c ->> 'competency', '')::smallint, i);
    end if;
    i := i + 1;
  end loop;

  if p_return then
    update public.essays
    set status = 'corrigida', corrected_at = now(),
        corrector_id = coalesce(corrector_id, v_uid), started_at = coalesce(started_at, now())
    where id = p_essay;
    -- XP pela redação corrigida: 50, uma vez por redação.
    if not exists (select 1 from public.xp_events x where x.reason = 'redacao' and x.ref_id = p_essay) then
      perform public.award_xp(v_essay.student_id, 50, 'redacao', p_essay);
    end if;
  else
    update public.essays
    set status = 'em_correcao', corrector_id = coalesce(corrector_id, v_uid), started_at = coalesce(started_at, now())
    where id = p_essay and status = 'enviada';
  end if;

  return v_total;
end;
$$;
revoke all on function public.save_essay_review(uuid, integer[], text[], text, jsonb, boolean) from public, anon;
grant execute on function public.save_essay_review(uuid, integer[], text[], text, jsonb, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado "redacoes", um diretório por aluno ({uid}/arquivo).
-- Só roda onde o schema storage existe (Supabase); os testes em PGlite criam
-- um stub mínimo para conferir as policies.
-- -----------------------------------------------------------------------------

do $storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('redacoes', 'redacoes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  -- Aluno envia só para a própria pasta.
  execute $p$
    create policy "redacoes: student uploads to own folder" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'redacoes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  -- Aluno lê os próprios arquivos; o dono do curso lê os anexos das redações do curso.
  execute $p$
    create policy "redacoes: student or course owner reads" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'redacoes'
        and (
          (storage.foldername(name))[1] = (select auth.uid())::text
          or exists (
            select 1 from public.essays e
            where e.file_path = name and public.is_course_owner(e.course_id)
          )
        )
      )
  $p$;
  -- Aluno pode apagar arquivo que ainda não virou redação (upload abandonado).
  execute $p$
    create policy "redacoes: student deletes unused file" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'redacoes'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and not exists (select 1 from public.essays e where e.file_path = name)
      )
  $p$;
end;
$storage$;
