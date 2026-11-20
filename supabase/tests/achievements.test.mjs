import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// As 30 conquistas: regras novas da migration 20261122000000_mais_conquistas.sql.
const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => new URL(f, dir));
const migration = files.map((f) => readFileSync(f, "utf8")).join("\n").replace(/create extension if not exists pgcrypto;/i, "");
const db = new PGlite();

const ok = (m) => console.log("  ✓", m);
const fail = (m) => {
  console.log("  ✗", m);
  process.exitCode = 1;
};
async function expectError(label, fn) {
  try {
    await fn();
    fail(`${label} (deveria falhar)`);
  } catch (e) {
    ok(`${label} → bloqueado (${e.message.split("\n")[0]})`);
  }
}

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
await db.exec(migration);
ok(`${files.length} migration(s) aplicada(s)`);

async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

let n = 0;
const user = async (name) => {
  const id = `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${n}@x`, { full_name: name }]);
  return id;
};
const badges = async (uid) => (await db.query(`select achievement_slug s from public.user_achievements where user_id = $1`, [uid])).rows.map((x) => x.s);
const has = async (uid, slug) => (await badges(uid)).includes(slug);
const check = async (label, uid, slug, expected = true) =>
  (await has(uid, slug)) === expected ? ok(label) : fail(`${label}: ${await badges(uid)}`);

let slugN = 0;
async function course(owner, { subject = null, level = null, status = "published", lessons = 1 } = {}) {
  const c = await db.query(
    `insert into public.courses (owner_id, slug, title, subject, level, status) values ($1, $2, 'Curso teste', $3, $4, $5) returning id`,
    [owner, `t-${++slugN}-abc`, subject, level, status],
  );
  const id = c.rows[0].id;
  const m = await db.query(`insert into public.modules (course_id, title) values ($1, 'M') returning id`, [id]);
  const ls = [];
  for (let i = 0; i < lessons; i++) {
    const l = await db.query(`insert into public.lessons (course_id, module_id, title, position, xp_reward) values ($1, $2, 'A', $3, 10) returning id`, [id, m.rows[0].id, i]);
    ls.push(l.rows[0].id);
  }
  return { id, lessons: ls };
}
async function question(courseId) {
  const q = await db.query(`insert into public.questions (course_id, statement, difficulty, xp_reward) values ($1, '1+1?', 'easy', 5) returning id`, [courseId]);
  const qid = q.rows[0].id;
  const o = await db.query(`insert into public.question_options (question_id, body, position) values ($1,'1',0),($1,'2',1) returning id, position`, [qid]);
  const right = o.rows.find((r) => r.position === 1).id;
  const wrong = o.rows.find((r) => r.position === 0).id;
  await db.query(`insert into public.question_answers (question_id, course_id, correct_option_id) values ($1,$2,$3)`, [qid, courseId, right]);
  return { qid, right, wrong };
}
const enroll = (uid, courseId) => db.query(`insert into public.enrollments (user_id, course_id, source) values ($1,$2,'free') on conflict do nothing`, [uid, courseId]);
const done = (uid, c, lessonId, at = null) =>
  db.query(`insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at) values ($1,$2,$3, coalesce($4::timestamptz, now()))`, [uid, lessonId, c.id, at]);

// Catálogo
let r = await as(null, `select count(*)::int n, max(position)::int p from public.achievements`);
r.rows[0].n === 30 && r.rows[0].p === 30 ? ok("visitante vê as 30 conquistas") : fail(`catálogo: ${JSON.stringify(r.rows[0])}`);
r = await db.query(`select count(*)::int n from public.achievements where slug in ('coruja','madrugador','fim-de-semana','centuriao','mil-xp','dez-mil-xp','redator','linguagens','humanas','natureza','matematica','professor','mestre-das-questoes','comunidade','persistente','relampago','lenda','explorador')`);
r.rows[0].n === 18 ? ok("18 conquistas novas com os slugs das medalhas") : fail(`novas: ${r.rows[0].n}`);

const PROF = await user("Prof");
const ALUNA = await user("Aluna");
const base = await course(PROF, { lessons: 3 });
await check("Professor ao publicar o primeiro curso", PROF, "professor");
const rascunho = await user("Rascunho");
await course(rascunho, { status: "draft" });
await check("rascunho não dá Professor", rascunho, "professor", false);

// Horários (Brasília = UTC-3)
await enroll(ALUNA, base.id);
await done(ALUNA, base, base.lessons[0], "2026-11-20T15:00:00Z"); // 12h
await check("estudar ao meio-dia não dá Coruja", ALUNA, "coruja", false);
await check("estudar ao meio-dia não dá Madrugador", ALUNA, "madrugador", false);
await done(ALUNA, base, base.lessons[1], "2026-11-21T02:30:00Z"); // 23h30 de sexta
await check("Coruja depois das 23h", ALUNA, "coruja");
await done(ALUNA, base, base.lessons[2], "2026-11-21T09:00:00Z"); // 6h de sábado
await check("Madrugador antes das 7h", ALUNA, "madrugador");
await check("só sábado não dá Fim de Semana", ALUNA, "fim-de-semana", false);
{
  const q = await question(base.id);
  await db.query(`insert into public.question_attempts (user_id, question_id, course_id, option_id, is_correct, created_at) values ($1,$2,$3,$4,true,'2026-11-22T15:00:00Z')`, [ALUNA, q.qid, base.id, q.right]);
}
await check("Fim de Semana: sábado e domingo", ALUNA, "fim-de-semana");

// XP
await db.query(`update public.profiles set xp = 999 where id = $1`, [ALUNA]);
await check("999 XP não dá Mil XP", ALUNA, "mil-xp", false);
await db.query(`update public.profiles set xp = 1000 where id = $1`, [ALUNA]);
await check("Mil XP", ALUNA, "mil-xp");
await db.query(`update public.profiles set xp = 10000 where id = $1`, [ALUNA]);
await check("Dez Mil XP", ALUNA, "dez-mil-xp");

// Áreas do ENEM e Redator
const ESTUDANTE = await user("Estudante");
const redacao = await course(PROF, { subject: "redacao", level: 1, lessons: 2 });
await enroll(ESTUDANTE, redacao.id);
await done(ESTUDANTE, redacao, redacao.lessons[0]);
await check("Redator ao concluir aula de Redação", ESTUDANTE, "redator");
await check("curso pela metade não dá Linguagens", ESTUDANTE, "linguagens", false);
await done(ESTUDANTE, redacao, redacao.lessons[1]);
await check("Linguagens ao zerar Redação", ESTUDANTE, "linguagens");
for (const [subject, slug] of [["historia", "humanas"], ["quimica", "natureza"], ["matematica", "matematica"]]) {
  const c = await course(PROF, { subject, level: 1 });
  await enroll(ESTUDANTE, c.id);
  await check(`sem aula, sem ${slug}`, ESTUDANTE, slug, false);
  await done(ESTUDANTE, c, c.lessons[0]);
  await check(`${slug} ao zerar ${subject}`, ESTUDANTE, slug);
}
await check("sem curso livre zerado, sem Humanas para a Aluna", ALUNA, "humanas", false);

// Centurião
const CDF = await user("CDF");
const grande = await course(PROF, { lessons: 100 });
await enroll(CDF, grande.id);
for (const [i, l] of grande.lessons.entries()) {
  await done(CDF, grande, l);
  if (i === 98) await check("99 aulas não dá Centurião", CDF, "centuriao", false);
}
await check("Centurião com 100 aulas", CDF, "centuriao");

// Explorador
const VIAJANTE = await user("Viajante");
const cursos = [];
for (let i = 0; i < 5; i++) cursos.push(await course(PROF));
for (const [i, c] of cursos.entries()) {
  await as(VIAJANTE, `select public.enroll_free($1)`, [c.id]);
  if (i === 3) await check("4 cursos não dá Explorador", VIAJANTE, "explorador", false);
}
await check("Explorador com 5 cursos", VIAJANTE, "explorador");

// Persistente (pelas RPCs reais)
const TEIMOSO = await user("Teimoso");
const pq = await question(base.id);
await as(TEIMOSO, `select public.enroll_free($1)`, [base.id]);
await as(TEIMOSO, `select * from public.answer_question($1,$2)`, [pq.qid, pq.right]);
await check("acertar de primeira não dá Persistente", TEIMOSO, "persistente", false);
const pq2 = await question(base.id);
await as(TEIMOSO, `select * from public.answer_question($1,$2)`, [pq2.qid, pq2.wrong]);
await check("só errar não dá Persistente", TEIMOSO, "persistente", false);
await as(TEIMOSO, `select * from public.answer_question($1,$2)`, [pq2.qid, pq2.right]);
await check("Persistente: errou e depois acertou", TEIMOSO, "persistente");

// Relâmpago e Mestre das Questões (o dono cria 50 questões)
const AUTORA = await user("Autora");
const banco = await course(AUTORA);
const qs = [];
for (let i = 0; i < 50; i++) {
  qs.push(await question(banco.id));
  if (i === 48) await check("49 questões não dá Mestre das Questões", AUTORA, "mestre-das-questoes", false);
}
await check("Mestre das Questões com 50 questões", AUTORA, "mestre-das-questoes");
const RAPIDO = await user("Rápido");
await enroll(RAPIDO, banco.id);
for (const [i, q] of qs.entries()) {
  await db.query(`insert into public.question_attempts (user_id, question_id, course_id, option_id, is_correct, created_at) values ($1,$2,$3,$4,true,'2026-11-20T13:00:00Z'::timestamptz + ($5 || ' minutes')::interval)`, [RAPIDO, q.qid, banco.id, q.right, i]);
  if (i === 48) await check("49 respostas no dia não dá Relâmpago", RAPIDO, "relampago", false);
}
await check("Relâmpago com 50 respostas no dia", RAPIDO, "relampago");

// Comunidade: 10 alunos nos cursos da Autora
for (let i = 0; i < 10; i++) {
  const aluno = await user(`Aluno ${i}`);
  await enroll(aluno, banco.id);
}
await check("Comunidade com 10+ alunos", AUTORA, "comunidade");
await check("sem alunos, sem Comunidade", rascunho, "comunidade", false);

// Lenda: 1º no ranking geral com 3+ alunos pontuando
const L1 = await user("Lenda 1");
const L2 = await user("Lenda 2");
await db.query(`update public.profiles set xp = 0 where xp > 0`);
await db.exec(`delete from public.user_achievements where achievement_slug = 'lenda'`);
await db.query(`update public.profiles set xp = 50 where id = $1`, [L2]);
await db.query(`update public.profiles set xp = 90 where id = $1`, [L1]);
await check("1º com só 2 alunos pontuando não dá Lenda", L1, "lenda", false);
await db.query(`update public.profiles set xp = 10 where id = $1`, [ALUNA]);
await db.query(`update public.profiles set xp = 91 where id = $1`, [L1]);
await check("Lenda ao ficar em 1º com 3+ alunos", L1, "lenda");
await check("2º lugar não ganha Lenda", L2, "lenda", false);

// Segurança
await expectError("aluno não chama check_achievements", () => as(ALUNA, `select public.check_achievements($1)`, [ALUNA]));
await expectError("aluno não chama check_achievements_base", () => as(ALUNA, `select public.check_achievements_base($1)`, [ALUNA]));
await expectError("aluno não lê horários de outro (study_moments)", () => as(ALUNA, `select * from public.study_moments($1)`, [CDF]));
await expectError("aluno não se dá Lenda", () => as(ALUNA, `insert into public.user_achievements (user_id, achievement_slug) values ($1,'lenda')`, [ALUNA]));

console.log(process.exitCode ? "\nFALHOU" : "\nTODOS OS TESTES PASSARAM");
