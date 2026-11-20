-- Curso On é 100% gratuito e open source: sem pagamentos e sem preço.
-- Qualquer pessoa logada pode se matricular em um curso publicado.

drop table if exists public.payments;

alter table public.courses
  drop column if exists price_cents,
  drop column if exists currency;

-- Matrículas antigas feitas pelo Stripe continuam valendo, como "manual".
update public.enrollments set source = 'manual' where source = 'stripe';
alter table public.enrollments drop constraint if exists enrollments_source_check;
alter table public.enrollments
  add constraint enrollments_source_check check (source in ('free', 'manual'));

-- Matrícula grátis em qualquer curso publicado (antes exigia price_cents = 0).
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
  insert into public.enrollments (user_id, course_id, source)
  values (v_uid, p_course, 'free')
  on conflict (user_id, course_id) do nothing;
end;
$$;
revoke all on function public.enroll_free(uuid) from public, anon;
grant execute on function public.enroll_free(uuid) to authenticated;

-- O próprio aluno também pode se matricular direto pela API (por exemplo, pelo
-- painel), mas só em nome dele, só como 'free' e só em curso publicado.
-- Continua sem update/delete: sair de um curso não apaga o progresso.
create policy "enrollments: self-enroll in published course" on public.enrollments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and source = 'free'
    and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  );
