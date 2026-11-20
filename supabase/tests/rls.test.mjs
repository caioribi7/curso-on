import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// Todas as migrations em ordem (ou um arquivo específico passado como argumento).
const dir = new URL("../migrations/", import.meta.url);
const files = process.argv[2] ? [process.argv[2]] : readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => new URL(f, dir));
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

const OWNER = "00000000-0000-0000-0000-000000000001";
const STUDENT = "00000000-0000-0000-0000-000000000002";
const STRANGER = "00000000-0000-0000-0000-000000000003";
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
   ('${OWNER}', 'o@x', '{"full_name":"Prof"}'), ('${STUDENT}', 's@x', '{"full_name":"Aluna"}'), ('${STRANGER}', 'x@x', '{}');
`);
const profiles = await db.query("select id, full_name from public.profiles order by id");
profiles.rows.length === 3 ? ok("trigger cria perfis") : fail("perfis");

async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

// Owner creates a free course, module, lesson, content, question
const c = await as(OWNER, `insert into public.courses (owner_id, slug, title, theme_color, icon) values ($1, 'mat-abc12', 'Matemática', '#3B5BFD', 'abacus') returning id`, [OWNER]);
const courseId = c.rows[0].id;
ok("dono cria curso");
const m = await as(OWNER, `insert into public.modules (course_id, title, icon, position) values ($1, 'M1', 'blocks', 0) returning id`, [courseId]);
const l = await as(OWNER, `insert into public.lessons (course_id, module_id, title, position, xp_reward) values ($1, $2, 'Aula 1', 0, 20) returning id`, [courseId, m.rows[0].id]);
const lessonId = l.rows[0].id;
await as(OWNER, `insert into public.lesson_contents (lesson_id, course_id, body) values ($1, $2, 'segredo')`, [lessonId, courseId]);
const q = await as(OWNER, `insert into public.questions (course_id, statement, difficulty, xp_reward) values ($1, '2+2?', 'easy', 5) returning id`, [courseId]);
const qid = q.rows[0].id;
const opts = await as(OWNER, `insert into public.question_options (question_id, body, position) values ($1,'3',0),($1,'4',1) returning id, position`, [qid]);
const right = opts.rows.find((r) => r.position === 1).id;
const wrong = opts.rows.find((r) => r.position === 0).id;
await as(OWNER, `insert into public.question_answers (question_id, course_id, correct_option_id) values ($1,$2,$3)`, [qid, courseId, right]);
ok("dono cria módulo, aula, conteúdo, questão e gabarito");

// Draft invisible to others
let r = await as(STUDENT, `select id from public.courses where id = $1`, [courseId]);
r.rows.length === 0 ? ok("rascunho invisível para aluno") : fail("rascunho visível");
await expectError("aluno não matricula em rascunho", () => as(STUDENT, `select public.enroll_free($1)`, [courseId]));

await as(OWNER, `update public.courses set status='published' where id=$1`, [courseId]);
r = await as(null, `select id from public.courses where id = $1`, [courseId]);
r.rows.length === 1 ? ok("publicado visível para anônimo") : fail("publicado invisível");

// Gated content
r = await as(STUDENT, `select body from public.lesson_contents where lesson_id=$1`, [lessonId]);
r.rows.length === 0 ? ok("conteúdo bloqueado antes da matrícula") : fail("conteúdo vazou");
r = await as(STUDENT, `select * from public.question_answers`);
r.rows.length === 0 ? ok("gabarito invisível para aluno") : fail("gabarito vazou");

// Direct writes blocked
await expectError("aluno não insere matrícula direto", () => as(STUDENT, `insert into public.enrollments (user_id, course_id, source) values ($1,$2,'manual')`, [STUDENT, courseId]));
await expectError("aluno não altera XP", () => as(STUDENT, `update public.profiles set xp = 99999 where id = $1`, [STUDENT]));
await expectError("aluno não chama award_xp", () => as(STUDENT, `select public.award_xp($1, 1000, 'lesson_completed', null)`, [STUDENT]));
await expectError("aluno não edita curso alheio", async () => {
  const res = await as(STUDENT, `update public.courses set title='hack' where id=$1 returning id`, [courseId]);
  if (res.rows.length === 0) throw new Error("0 linhas (RLS)");
});

// Enroll + progress
await as(STUDENT, `select public.enroll_free($1)`, [courseId]);
ok("matrícula grátis via RPC");
r = await as(STUDENT, `select body from public.lesson_contents where lesson_id=$1`, [lessonId]);
r.rows[0]?.body === "segredo" ? ok("conteúdo liberado após matrícula") : fail("conteúdo não liberado");
r = await as(STUDENT, `select public.complete_lesson($1) as xp`, [lessonId]);
r.rows[0].xp === 20 ? ok("concluir aula dá 20 XP") : fail(`xp=${r.rows[0].xp}`);
r = await as(STUDENT, `select public.complete_lesson($1) as xp`, [lessonId]);
r.rows[0].xp === 0 ? ok("sem XP duplicado") : fail("XP duplicado");
r = await as(STUDENT, `select * from public.answer_question($1,$2)`, [qid, wrong]);
!r.rows[0].is_correct && r.rows[0].xp_gained === 0 ? ok("resposta errada: 0 XP, mostra correta") : fail("errada");
r = await as(STUDENT, `select * from public.answer_question($1,$2)`, [qid, right]);
r.rows[0].is_correct && r.rows[0].xp_gained === 5 ? ok("resposta certa: +5 XP") : fail(JSON.stringify(r.rows[0]));
r = await as(STUDENT, `select * from public.answer_question($1,$2)`, [qid, right]);
r.rows[0].xp_gained === 0 ? ok("acerto repetido: 0 XP") : fail("xp repetido");
r = await as(STUDENT, `select xp, streak_days from public.profiles where id=$1`, [STUDENT]);
r.rows[0].xp === 25 && r.rows[0].streak_days === 1 ? ok("perfil: 25 XP, sequência 1") : fail(JSON.stringify(r.rows[0]));
r = await as(STUDENT, `select * from public.course_leaderboard($1, 5)`, [courseId]);
r.rows.length >= 1 ? ok(`ranking: ${JSON.stringify(r.rows)}`) : fail("ranking");

await expectError("estranho não conclui aula", () => as(STRANGER, `select public.complete_lesson($1)`, [lessonId]));
await expectError("estranho não responde questão", () => as(STRANGER, `select * from public.answer_question($1,$2)`, [qid, right]));
r = await as(OWNER, `select count(*)::int n from public.enrollments where course_id=$1`, [courseId]);
r.rows[0].n === 1 ? ok("dono vê matrículas do curso") : fail("dono não vê");
r = await as(STRANGER, `select count(*)::int n from public.enrollments`);
r.rows[0].n === 0 ? ok("estranho não vê matrículas") : fail("matrículas vazaram");

// Tudo grátis: matrícula direta pela API, só em nome próprio e em curso publicado
const pub = await as(OWNER, `insert into public.courses (owner_id, slug, title, theme_color, icon, status) values ($1,'livre-xyz12','Livre','#FF6B4A','code','published') returning id`, [OWNER]);
const pubId = pub.rows[0].id;
r = await as(STRANGER, `insert into public.enrollments (user_id, course_id, source) values ($1,$2,'free') returning id`, [STRANGER, pubId]);
r.rows.length === 1 ? ok("aluno se matricula direto em curso publicado") : fail("auto-matrícula");
await expectError("matrícula em nome de outro", () => as(STRANGER, `insert into public.enrollments (user_id, course_id, source) values ($1,$2,'free')`, [STUDENT, pubId]));
const draft = await as(OWNER, `insert into public.courses (owner_id, slug, title) values ($1,'rascunho-xyz12','Rascunho') returning id`, [OWNER]);
await expectError("matrícula direta em rascunho", () => as(STRANGER, `insert into public.enrollments (user_id, course_id, source) values ($1,$2,'free')`, [STRANGER, draft.rows[0].id]));
// Venda é opcional: todo curso nasce grátis (detalhes em vendas.test.mjs).
r = await db.query("select count(*)::int n from public.courses where price_cents <> 0");
r.rows[0].n === 0 ? ok("cursos nascem grátis (price_cents = 0)") : fail("preço padrão");

r = await as(STUDENT, `update public.profiles set full_name = 'Aluna Nova' where id = $1 returning full_name`, [STUDENT]);
r.rows[0]?.full_name === "Aluna Nova" ? ok("aluno edita o próprio nome") : fail("nome");
r = await as(STUDENT, `update public.profiles set full_name = 'x' where id = $1 returning id`, [OWNER]);
r.rows.length === 0 ? ok("aluno não edita nome alheio") : fail("nome alheio");

// ENEM: matéria + nível
const enem = await as(OWNER, `insert into public.courses (owner_id, slug, title, theme_color, icon, subject, level, status) values ($1,'enem-matematica-2','Matemática 2','#2534B8','abacus','matematica',2,'published') returning subject, level`, [OWNER]);
enem.rows[0]?.subject === "matematica" && enem.rows[0]?.level === 2 ? ok("curso ENEM com matéria e nível") : fail("curso ENEM");
await expectError("matéria desconhecida", () => as(OWNER, `insert into public.courses (owner_id, slug, title, subject, level) values ($1,'x-astro','Astrologia','astrologia',1)`, [OWNER]));
await expectError("nível 3", () => as(OWNER, `insert into public.courses (owner_id, slug, title, subject, level) values ($1,'x-fis3','Física 3','fisica',3)`, [OWNER]));
await expectError("matéria sem nível", () => as(OWNER, `insert into public.courses (owner_id, slug, title, subject) values ($1,'x-fis','Física','fisica')`, [OWNER]));
r = await as(null, `select count(*)::int n from public.courses where subject = 'matematica' and level = 2`);
r.rows[0].n === 1 ? ok("visitante vê curso ENEM publicado") : fail("catálogo ENEM");

// Conquistas
const badges = async (uid) => (await db.query(`select achievement_slug s from public.user_achievements where user_id = $1`, [uid])).rows.map((x) => x.s);
r = await as(null, `select count(*)::int n from public.achievements`);
r.rows[0].n === 30 ? ok("visitante vê as 30 conquistas") : fail(`conquistas: ${r.rows[0].n}`);
(await badges(STRANGER)).includes("calouro") ? ok("Calouro ao criar conta") : fail("calouro");
{
  const b = await badges(STUDENT);
  b.includes("primeira-aula") && b.includes("na-mosca") ? ok("Primeira Aula e Na Mosca liberadas") : fail(`aluno: ${b}`);
  b.includes("curso-zerado") ? ok("Curso Zerado ao concluir todas as aulas") : fail(`curso zerado: ${b}`);
}
(await badges(STRANGER)).includes("primeira-aula") ? fail("estranho ganhou Primeira Aula") : ok("sem aula, sem Primeira Aula");
await expectError("aluno não se dá conquista", () => as(STUDENT, `insert into public.user_achievements (user_id, achievement_slug) values ($1,'imparavel')`, [STUDENT]));
await expectError("aluno não chama check_achievements", () => as(STUDENT, `select public.check_achievements($1)`, [STUDENT]));
await expectError("aluno não cria conquista", () => as(STUDENT, `insert into public.achievements (slug, name, description) values ('hack','Hack','x')`));

// Sobe de Nível: zera Física 1 e se matricula em Física 2
const f1 = await as(OWNER, `insert into public.courses (owner_id, slug, title, subject, level, status) values ($1,'fis-1-t','Física 1','fisica',1,'published') returning id`, [OWNER]);
const f2 = await as(OWNER, `insert into public.courses (owner_id, slug, title, subject, level, status) values ($1,'fis-2-t','Física 2','fisica',2,'published') returning id`, [OWNER]);
const fm = await as(OWNER, `insert into public.modules (course_id, title) values ($1,'M') returning id`, [f1.rows[0].id]);
const fl = await as(OWNER, `insert into public.lessons (course_id, module_id, title, xp_reward) values ($1,$2,'A',10) returning id`, [f1.rows[0].id, fm.rows[0].id]);
await as(STRANGER, `select public.enroll_free($1)`, [f1.rows[0].id]);
await as(STRANGER, `select public.complete_lesson($1)`, [fl.rows[0].id]);
(await badges(STRANGER)).includes("sobe-de-nivel") ? fail("Sobe de Nível antes do nível 2") : ok("sem nível 2, sem Sobe de Nível");
await as(STRANGER, `select public.enroll_free($1)`, [f2.rows[0].id]);
(await badges(STRANGER)).includes("sobe-de-nivel") ? ok("Sobe de Nível ao começar o nível 2") : fail("sobe de nível");
r = await db.query(`select public.subject_area('fisica') a, public.subject_area('redacao') b`);
r.rows[0].a === "natureza" && r.rows[0].b === "linguagens" ? ok("matéria → área do ENEM") : fail("subject_area");

// Perfil público e ranking geral
r = await as(null, `select * from public.public_profile($1)`, [STUDENT]);
r.rows[0]?.full_name && !("email" in r.rows[0]) ? ok("perfil público para visitante, sem e-mail") : fail("perfil público");
r = await as(STUDENT, `select * from public.global_ranking('all')`);
r.rows.some((x) => x.is_me && Number(x.pos) >= 1) ? ok("ranking geral mostra a posição do aluno") : fail(`ranking: ${JSON.stringify(r.rows)}`);
r = await as(STUDENT, `select * from public.global_ranking('week')`);
r.rows.length >= 1 ? ok("ranking da semana") : fail("ranking semana");
await expectError("visitante não vê ranking geral", () => as(null, `select * from public.global_ranking('all')`));
await expectError("período inválido", () => as(STUDENT, `select * from public.global_ranking('ano')`));

console.log(process.exitCode ? "\nFALHOU" : "\nTODOS OS TESTES PASSARAM");
