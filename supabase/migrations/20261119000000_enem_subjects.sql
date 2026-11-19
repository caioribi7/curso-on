-- ENEM focus: every course can belong to a subject and a level (1 or 2).
-- Keys must match content/subjects.json.

alter table public.courses
  add column subject text
    check (subject in (
      'portugues', 'literatura', 'redacao', 'ingles', 'espanhol',
      'historia', 'geografia', 'filosofia', 'sociologia',
      'biologia', 'quimica', 'fisica', 'matematica'
    )),
  add column level smallint check (level in (1, 2)),
  add constraint courses_subject_level_together
    check ((subject is null) = (level is null));

create index courses_subject_idx on public.courses (subject, level) where status = 'published';
