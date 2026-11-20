-- Venda de cursos (opcional). Criar e publicar continua grátis; quem quiser
-- pode pôr preço no próprio curso e receber pela Stripe. Preço 0 = grátis,
-- que é o padrão de todo curso.
--
-- Confiança: matrícula paga só nasce no webhook da Stripe (assinatura
-- conferida no servidor, que grava com a chave secreta do Supabase). Nenhum
-- cliente consegue se matricular de graça num curso pago.

alter table public.courses
  add column if not exists price_cents integer not null default 0
    check (price_cents >= 0 and price_cents <= 10000000),
  add column if not exists currency text not null default 'brl'
    check (currency in ('brl', 'usd', 'eur'));

alter table public.enrollments drop constraint if exists enrollments_source_check;
alter table public.enrollments
  add constraint enrollments_source_check check (source in ('free', 'manual', 'stripe'));

create table if not exists public.payments (
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
create index if not exists payments_course_idx on public.payments (course_id, created_at desc);
create index if not exists payments_intent_idx on public.payments (stripe_payment_intent_id);
alter table public.payments enable row level security;

-- Aluno vê as compras dele; o dono do curso vê as vendas do curso. Escrita só pelo webhook.
drop policy if exists "payments: read own" on public.payments;
create policy "payments: own or course owner" on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_course_owner(course_id));
revoke insert, update, delete on public.payments from anon, authenticated;

-- Matrícula grátis: só em curso publicado E sem preço.
create or replace function public.enroll_free(p_course uuid)
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
  if not exists (select 1 from public.courses where id = p_course and status = 'published') then
    raise exception 'course_not_available' using errcode = '42501';
  end if;
  if exists (select 1 from public.courses where id = p_course and price_cents > 0) then
    raise exception 'course_is_paid' using errcode = '42501';
  end if;
  insert into public.enrollments (user_id, course_id, source)
  values (v_uid, p_course, 'free')
  on conflict (user_id, course_id) do nothing;
end;
$$;
revoke all on function public.enroll_free(uuid) from public, anon;
grant execute on function public.enroll_free(uuid) to authenticated;

drop policy if exists "enrollments: self-enroll in published course" on public.enrollments;
create policy "enrollments: self-enroll in published free course" on public.enrollments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and source = 'free'
    and exists (
      select 1 from public.courses c
      where c.id = course_id and c.status = 'published' and c.price_cents = 0
    )
  );

-- Redação: enviar num tema matricula o aluno de graça só se o curso for grátis.
-- Em curso pago, precisa já estar matriculado (ter comprado).
create or replace function public.submit_essay(
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
  v_price integer;
  v_id uuid;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_path text := nullif(btrim(coalesce(p_file_path, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select t.course_id, c.price_cents into v_course, v_price
  from public.essay_themes t
  join public.courses c on c.id = t.course_id
  where t.id = p_theme and t.is_open and c.status = 'published';
  if v_course is null then
    raise exception 'theme_not_available' using errcode = '42501';
  end if;

  if v_price > 0 and not exists (
    select 1 from public.enrollments e where e.user_id = v_uid and e.course_id = v_course
  ) and not public.is_course_owner(v_course) then
    raise exception 'course_is_paid' using errcode = '42501';
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
