import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// Simulados e listas: migration 20261123130000_simulados_listas.sql.
const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => new URL(f, dir));
const migration = files.map((f) => readFileSync(f, "utf8")).join("\n").replace(/create extension if not exists pgcrypto;/i, "");
const db = new PGlite();

const ok = (m) => console.log("  ✓", m);
const fail = (m) => {
  console.log("  ✗", m);
  process.exitCode = 1;
};
async function expectError(label, fn, code) {
  try {
    await fn();
    fail(`${label} (deveria falhar)`);
  } catch (e) {
    const msg = e.message.split("\n")[0];
    if (code && !msg.includes(code)) fail(`${label}: erro inesperado (${msg})`);
    else ok(`${label} → bloqueado (${msg})`);
  }
}
const eq = (label, got, want) => (JSON.stringify(got) === JSON.stringify(want) ? ok(label) : fail(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`));

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
let slugN = 0;
async function course(owner, subject, level = 1, status = "published") {
  const c = await db.query(`insert into public.courses (owner_id, slug, title, subject, level, status) values ($1, $2, $3, $4, $5, $6) returning id`, [
    owner,
    `s-${++slugN}-abc`,
    `Curso ${subject}`,
    subject,
    level,
    status,
  ]);
  return c.rows[0].id;
}
async function question(courseId, xp = 5) {
  const q = await db.query(`insert into public.questions (course_id, statement, xp_reward) values ($1, 'Quanto é $1+1$?', $2) returning id`, [courseId, xp]);
  const qid = q.rows[0].id;
  const o = await db.query(`insert into public.question_options (question_id, body, position) values ($1,'1',0),($1,'2',1),($1,'3',2) returning id, position`, [qid]);
  const right = o.rows.find((r) => r.position === 1).id;
  const wrong = o.rows.find((r) => r.position === 0).id;
  await db.query(`insert into public.question_answers (question_id, course_id, correct_option_id) values ($1,$2,$3)`, [qid, courseId, right]);
  return { qid, right, wrong };
}
const enroll = (uid, courseId) => db.query(`insert into public.enrollments (user_id, course_id, source) values ($1,$2,'free')`, [uid, courseId]);
const xpOf = async (uid) => (await db.query(`select xp from public.profiles where id = $1`, [uid])).rows[0].xp;

const PROF = await user("Prof");
const ALUNA = await user("Aluna");
const INTRUSO = await user("Intruso");

const MAT = await course(PROF, "matematica", 1);
const FIS = await course(PROF, "fisica", 2);
const HIS = await course(PROF, "historia", 1);
const matQs = [];
for (let i = 0; i < 6; i++) matQs.push(await question(MAT, 10));
const fisQs = [await question(FIS), await question(FIS)];
await question(HIS);
// Questão sem gabarito não entra em sorteio.
await db.query(`insert into public.questions (course_id, statement) values ($1, 'Sem gabarito')`, [MAT]);
await enroll(ALUNA, MAT);
await enroll(ALUNA, FIS);

// ---------------------------------------------------------------- Sorteio
let r = await as(ALUNA, `select count(*)::int n from public.pick_questions(p_count => 100)`);
eq("aluna sorteia só dos cursos matriculados (6 mat + 2 fís)", r.rows[0].n, 8);
r = await as(ALUNA, `select count(*)::int n from public.pick_questions(p_areas => array['natureza'], p_count => 100)`);
eq("filtro por área do ENEM", r.rows[0].n, 2);
r = await as(ALUNA, `select count(*)::int n from public.pick_questions(p_subjects => array['matematica'], p_levels => array[2]::smallint[], p_count => 100)`);
eq("filtro por matéria e nível", r.rows[0].n, 0);
r = await as(INTRUSO, `select count(*)::int n from public.pick_questions(p_count => 100)`);
eq("quem não é aluno não sorteia nada", r.rows[0].n, 0);
r = await as(PROF, `select count(*)::int n from public.pick_questions(p_count => 100)`);
eq("professor sorteia do próprio banco (com gabarito)", r.rows[0].n, 9);
await expectError("visitante não sorteia", () => as(null, `select * from public.pick_questions()`));
await expectError("cliente não chama question_pool", () => as(ALUNA, `select * from public.question_pool($1, null, null, null, null)`, [ALUNA]));

// ---------------------------------------------------------------- Simulado por filtros
await expectError("sem questões no filtro", () => as(ALUNA, `select public.start_mock_exam(p_areas => array['humanas'], p_count => 5)`), "no_questions");
await expectError("mais de 90 questões", () => as(ALUNA, `select public.start_mock_exam(p_count => 91)`), "invalid_count");
r = await as(ALUNA, `select public.start_mock_exam(p_subjects => array['matematica'], p_count => 5, p_title => 'Matemática 1') id`);
const A1 = r.rows[0].id;
r = await as(ALUNA, `select total_count, duration_minutes, title, submitted_at from public.mock_attempts where id = $1`, [A1]);
eq("tentativa criada com 5 questões e 15 min", [r.rows[0].total_count, r.rows[0].duration_minutes, r.rows[0].title, r.rows[0].submitted_at], [5, 15, "Matemática 1", null]);
r = await as(ALUNA, `select question_id, course_id, is_correct from public.mock_attempt_items where attempt_id = $1 order by position`, [A1]);
const items = r.rows;
eq("itens visíveis para a dona, todos de matemática e sem correção", [items.length, items.every((i) => i.course_id === MAT), items.every((i) => i.is_correct === null)], [5, true, true]);
r = await as(INTRUSO, `select count(*)::int n from public.mock_attempt_items where attempt_id = $1`, [A1]);
eq("intruso não vê itens da tentativa alheia", r.rows[0].n, 0);
r = await as(INTRUSO, `select count(*)::int n from public.mock_attempts`);
eq("intruso não vê tentativas alheias", r.rows[0].n, 0);

await expectError("aluna não escreve tentativas direto", () => as(ALUNA, `update public.mock_attempts set correct_count = 99 where id = $1`, [A1]).then((x) => {
  if (x.affectedRows === 0) throw new Error("0 linhas (RLS)");
}));
await expectError("aluna não insere itens direto", () => as(ALUNA, `insert into public.mock_attempt_items (attempt_id, position, question_id, course_id) values ($1, 99, $2, $3)`, [A1, fisQs[0].qid, FIS]));
await expectError("aluna não lê o gabarito", () =>
  as(ALUNA, `select count(*)::int n from public.question_answers`).then((x) => {
    if (x.rows[0].n === 0) throw new Error("0 linhas (RLS)");
  }),
);
await expectError("revisão antes de entregar", () => as(ALUNA, `select * from public.mock_attempt_review($1)`, [A1]), "not_submitted");

const byId = new Map(matQs.map((q) => [q.qid, q]));
// Acerta 3, erra 1, deixa 1 em branco.
for (const [i, it] of items.entries()) {
  const q = byId.get(it.question_id);
  if (i < 3) await as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A1, q.qid, q.wrong]);
  if (i < 3) await as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A1, q.qid, q.right]); // troca de ideia
  if (i === 3) await as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A1, q.qid, q.wrong]);
}
r = await as(ALUNA, `select count(*)::int n from public.mock_attempt_items where attempt_id = $1 and option_id is not null`, [A1]);
eq("respostas salvas durante a prova (4 de 5)", r.rows[0].n, 4);
await expectError("alternativa de outra questão", () => as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A1, items[0].question_id, fisQs[0].right]), "invalid_option");
await expectError("questão fora da tentativa", () => as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A1, fisQs[0].qid, fisQs[0].right]), "question_not_in_attempt");
await expectError("intruso não responde na tentativa alheia", () => as(INTRUSO, `select public.save_mock_answer($1,$2,$3)`, [A1, items[0].question_id, null]), "attempt_not_found");
await expectError("intruso não entrega a tentativa alheia", () => as(INTRUSO, `select * from public.submit_mock_exam($1)`, [A1]), "attempt_not_found");

const xpBefore = await xpOf(ALUNA);
r = await as(ALUNA, `select * from public.submit_mock_exam($1)`, [A1]);
eq("entrega: 3 de 5, XP = 3×10 + 10 de bônus", r.rows[0], { correct_count: 3, total_count: 5, xp_gained: 40 });
eq("XP somado ao perfil", (await xpOf(ALUNA)) - xpBefore, 40);
r = await db.query(`select reason, ref_id from public.xp_events where user_id = $1 and reason = 'mock_exam_completed'`, [ALUNA]);
eq("evento de XP do simulado", [r.rows.length, r.rows[0]?.ref_id], [1, A1]);
r = await db.query(`select count(*)::int n, count(*) filter (where is_correct)::int c from public.question_attempts where user_id = $1`, [ALUNA]);
eq("respostas viram tentativas de prática (4, 3 certas)", [r.rows[0].n, r.rows[0].c], [4, 3]);
r = await as(ALUNA, `select * from public.submit_mock_exam($1)`, [A1]);
eq("entregar de novo não dá XP duplicado", [r.rows[0].xp_gained, (await xpOf(ALUNA)) - xpBefore], [40, 40]);
await expectError("não responde depois de entregar", () => as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A1, items[4].question_id, null]), "already_submitted");

r = await as(ALUNA, `select * from public.mock_attempt_review($1)`, [A1]);
eq("revisão traz gabarito, matéria e área", [r.rows.length, r.rows[0].subject, r.rows[0].area, r.rows.every((x) => x.correct_option_id)], [5, "matematica", "matematica", true]);
eq("revisão marca certo/errado/branco", r.rows.map((x) => x.is_correct), [true, true, true, false, false]);
await expectError("intruso não vê a revisão", () => as(INTRUSO, `select * from public.mock_attempt_review($1)`, [A1]), "attempt_not_found");

// Segundo simulado no mesmo dia: só XP de questões novas, sem bônus.
r = await as(ALUNA, `select public.start_mock_exam(p_subjects => array['matematica'], p_count => 6) id`);
const A2 = r.rows[0].id;
for (const it of (await as(ALUNA, `select question_id from public.mock_attempt_items where attempt_id = $1`, [A2])).rows) {
  await as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A2, it.question_id, byId.get(it.question_id).right]);
}
r = await as(ALUNA, `select * from public.submit_mock_exam($1)`, [A2]);
eq("2º simulado: 6/6, XP só das 3 inéditas, sem bônus", r.rows[0], { correct_count: 6, total_count: 6, xp_gained: 30 });

// Banco menor que o pedido: tempo proporcional (20 pedidas × 3 min, só 2 existem → 6 min).
r = await as(ALUNA, `select public.start_mock_exam(p_areas => array['natureza'], p_count => 20, p_minutes => 60) id`);
r = await as(ALUNA, `select total_count, duration_minutes, round(extract(epoch from deadline_at - started_at) / 60)::int span from public.mock_attempts where id = $1`, [r.rows[0].id]);
eq("tempo encolhe quando há menos questões", [r.rows[0].total_count, r.rows[0].duration_minutes, r.rows[0].span], [2, 6, 6]);

// Prazo
r = await as(ALUNA, `select public.start_mock_exam(p_areas => array['natureza'], p_count => 2, p_minutes => 1) id`);
const A3 = r.rows[0].id;
await db.query(`update public.mock_attempts set deadline_at = now() - interval '2 minutes' where id = $1`, [A3]);
await expectError("não salva depois do tempo", () => as(ALUNA, `select public.save_mock_answer($1,$2,$3)`, [A3, fisQs[0].qid, fisQs[0].right]), "time_over");
r = await as(ALUNA, `select * from public.submit_mock_exam($1)`, [A3]);
eq("entrega depois do tempo vale com o que foi salvo (0/2, sem bônus)", r.rows[0], { correct_count: 0, total_count: 2, xp_gained: 0 });

// ---------------------------------------------------------------- Simulado do professor
r = await as(PROF, `insert into public.mock_exams (course_id, title, duration_minutes) values ($1, 'Simulado 1', 30) returning id`, [MAT]);
const EX = r.rows[0].id;
await as(PROF, `insert into public.mock_exam_questions (mock_exam_id, question_id, position) values ($1,$2,1),($1,$3,0)`, [EX, matQs[0].qid, matQs[1].qid]);
await expectError("professor não põe questão de outro curso", () => as(PROF, `insert into public.mock_exam_questions (mock_exam_id, question_id) values ($1,$2)`, [EX, fisQs[0].qid]));
await expectError("aluna não cria simulado no curso alheio", () => as(ALUNA, `insert into public.mock_exams (course_id, title) values ($1, 'Hack')`, [MAT]));
r = await as(ALUNA, `select count(*)::int n from public.mock_exams`);
eq("rascunho do professor invisível para a aluna", r.rows[0].n, 0);
await expectError("aluna não começa simulado em rascunho", () => as(ALUNA, `select public.start_course_mock_exam($1)`, [EX]), "not_enrolled");
await as(PROF, `update public.mock_exams set status = 'published' where id = $1`, [EX]);
r = await as(ALUNA, `select count(*)::int n from public.mock_exams`);
eq("publicado aparece para a aluna", r.rows[0].n, 1);
r = await as(INTRUSO, `select count(*)::int n from public.mock_exams`);
eq("publicado não aparece para quem não é aluno", r.rows[0].n, 0);
await expectError("não aluno não começa simulado do curso", () => as(INTRUSO, `select public.start_course_mock_exam($1)`, [EX]), "not_enrolled");
r = await as(ALUNA, `select public.start_course_mock_exam($1) id`, [EX]);
const A4 = r.rows[0].id;
r = await as(ALUNA, `select a.duration_minutes, a.title, array_agg(i.question_id order by i.position) qs from public.mock_attempts a join public.mock_attempt_items i on i.attempt_id = a.id where a.id = $1 group by a.id`, [A4]);
eq("ordem e duração do professor", [r.rows[0].duration_minutes, r.rows[0].title, r.rows[0].qs], [30, "Simulado 1", [matQs[1].qid, matQs[0].qid]]);

// ---------------------------------------------------------------- Listas
r = await as(ALUNA, `insert into public.question_lists (owner_id, title) values ($1, 'Revisão') returning id`, [ALUNA]);
const L = r.rows[0].id;
await expectError("não cria lista em nome de outra pessoa", () => as(ALUNA, `insert into public.question_lists (owner_id, title) values ($1, 'Fake')`, [PROF]));
await as(ALUNA, `insert into public.question_list_items (list_id, question_id, position) values ($1,$2,0),($1,$3,1)`, [L, matQs[0].qid, fisQs[0].qid]);
ok("aluna adiciona questões dos cursos dela");
const hisQ = (await db.query(`select id from public.questions where course_id = $1`, [HIS])).rows[0].id;
await expectError("não adiciona questão de curso sem matrícula", () => as(ALUNA, `insert into public.question_list_items (list_id, question_id) values ($1,$2)`, [L, hisQ]));
await as(ALUNA, `update public.question_list_items set position = case position when 0 then 1 else 0 end where list_id = $1`, [L]);
r = await as(ALUNA, `select question_id from public.question_list_items where list_id = $1 order by position`, [L]);
eq("reordena a lista", r.rows.map((x) => x.question_id), [fisQs[0].qid, matQs[0].qid]);
r = await as(INTRUSO, `select (select count(*) from public.question_lists)::int l, (select count(*) from public.question_list_items)::int i`);
eq("lista é privada", [r.rows[0].l, r.rows[0].i], [0, 0]);
r = await as(INTRUSO, `delete from public.question_list_items where list_id = $1`, [L]);
eq("intruso não apaga itens", r.affectedRows ?? 0, 0);
await expectError("intruso não adiciona na lista alheia", () => as(INTRUSO, `insert into public.question_list_items (list_id, question_id) values ($1,$2)`, [L, hisQ]));
r = await as(PROF, `insert into public.question_lists (owner_id, title) values ($1, 'Lista do prof') returning id`, [PROF]);
await as(PROF, `insert into public.question_list_items (list_id, question_id) values ($1,$2)`, [r.rows[0].id, hisQ]);
r = await as(PROF, `select count(*)::int n from public.question_answers a join public.question_list_items i on i.question_id = a.question_id`);
eq("professor lê o gabarito das próprias questões para imprimir", r.rows[0].n, 1);
r = await as(ALUNA, `select count(*)::int n from public.pick_questions(p_count => 100, p_exclude => array[$1::uuid])`, [matQs[0].qid]);
eq("sorteio para lista exclui o que já está nela", r.rows[0].n, 7);

if (process.exitCode) console.log("\nFalhou.");
else console.log("\nSimulados e listas: tudo certo.");
