import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// Redação: temas, envio, fila de correção, devolução com XP e storage.
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

// Stub mínimo do Supabase: auth e storage (bucket + objects + foldername).
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
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
const PROF = await user("Prof");
const OUTRO_PROF = await user("Outro prof");
const ALUNA = await user("Aluna");
const ALUNO = await user("Aluno");

const course = async (owner, status = "published") =>
  (await db.query(`insert into public.courses (owner_id, slug, title, subject, level, status) values ($1, $2, 'Redação ENEM', 'redacao', 1, $3) returning id`, [owner, `r-${++n}-x`, status])).rows[0].id;
const CURSO = await course(PROF);
const RASCUNHO = await course(PROF, "draft");
const OUTRO_CURSO = await course(OUTRO_PROF);

// ---------------------------------------------------------------- Temas
let r = await as(PROF, `insert into public.essay_themes (course_id, title, motivating_text) values ($1, 'Desafios da educação digital', 'Texto I...') returning id`, [CURSO]);
const TEMA = r.rows[0].id;
ok("professor cria tema no próprio curso");
await expectError("professor não cria tema em curso alheio", () =>
  as(PROF, `insert into public.essay_themes (course_id, title) values ($1, 'Tema invasor')`, [OUTRO_CURSO]),
);
const TEMA_RASCUNHO = (await as(PROF, `insert into public.essay_themes (course_id, title) values ($1, 'Tema do rascunho') returning id`, [RASCUNHO])).rows[0].id;
const TEMA_FECHADO = (await as(PROF, `insert into public.essay_themes (course_id, title, is_open) values ($1, 'Tema fechado', false) returning id`, [CURSO])).rows[0].id;

r = await as(ALUNA, `select id from public.essay_themes`);
r.rows.length === 1 && r.rows[0].id === TEMA ? ok("aluna vê só temas abertos de cursos publicados") : fail(`temas visíveis: ${JSON.stringify(r.rows)}`);
r = await as(null, `select id from public.essay_themes`).catch(() => ({ rows: [] }));
r.rows.length === 0 ? ok("visitante não vê temas") : fail("visitante viu temas");
await expectError("aluna não edita tema", async () => {
  const u = await as(ALUNA, `update public.essay_themes set title = 'hack' where id = $1 returning id`, [TEMA]);
  if (u.rows.length === 0) throw new Error("nenhuma linha (RLS)");
});

// ---------------------------------------------------------------- Envio
const submit = (uid, theme, body, path = null, type = null) =>
  as(uid, `select public.submit_essay($1, 'Meu título', $2, $3, $4) as id`, [theme, body, path, type]);

await expectError("visitante não envia", () => submit(null, TEMA, "texto"));
await expectError("tema de curso em rascunho", () => submit(ALUNA, TEMA_RASCUNHO, "texto"), "theme_not_available");
await expectError("tema fechado", () => submit(ALUNA, TEMA_FECHADO, "texto"), "theme_not_available");
await expectError("redação vazia", () => submit(ALUNA, TEMA, "   "), "empty_essay");
await expectError("arquivo na pasta de outra pessoa", () => submit(ALUNA, TEMA, null, `${ALUNO}/x.jpg`, "image/jpeg"), "invalid_file");

r = await submit(ALUNA, TEMA, "A educação digital no Brasil enfrenta desafios. É preciso agir.");
const ESSAY = r.rows[0].id;
ok("aluna envia redação digitada");
r = await db.query(`select status from public.essays where id = $1`, [ESSAY]);
r.rows[0].status === "enviada" ? ok("status inicial: enviada") : fail(`status: ${r.rows[0].status}`);
r = await db.query(`select 1 from public.enrollments where user_id = $1 and course_id = $2`, [ALUNA, CURSO]);
r.rows.length === 1 ? ok("envio matricula a aluna no curso") : fail("sem matrícula");
await expectError("segunda redação pendente no mesmo tema", () => submit(ALUNA, TEMA, "outra"), "essay_pending");

await expectError("aluna não insere redação direto na tabela", () =>
  as(ALUNA, `insert into public.essays (theme_id, course_id, student_id, body) values ($1, $2, $3, 'x')`, [TEMA, CURSO, ALUNA]),
);
await expectError("aluna não muda o status direto", async () => {
  const u = await as(ALUNA, `update public.essays set status = 'corrigida' where id = $1 returning id`, [ESSAY]);
  if (u.rows.length === 0) throw new Error("nenhuma linha (RLS)");
});

// Storage: upload por foto.
await as(ALUNO, `insert into storage.objects (bucket_id, name, owner) values ('redacoes', $1, $2)`, [`${ALUNO}/foto.jpg`, ALUNO]);
ok("aluno envia arquivo para a própria pasta");
await expectError("aluno não envia para a pasta da aluna", () =>
  as(ALUNO, `insert into storage.objects (bucket_id, name, owner) values ('redacoes', $1, $2)`, [`${ALUNA}/foto.jpg`, ALUNO]),
);
r = await submit(ALUNO, TEMA, null, `${ALUNO}/foto.jpg`, "image/jpeg");
const ESSAY_FOTO = r.rows[0].id;
ok("aluno envia redação por foto");
r = await as(PROF, `select name from storage.objects where bucket_id = 'redacoes'`);
r.rows.length === 1 ? ok("dono do curso lê o anexo da redação") : fail(`prof vê ${r.rows.length} arquivos`);
r = await as(OUTRO_PROF, `select name from storage.objects where bucket_id = 'redacoes'`);
r.rows.length === 0 ? ok("outro professor não lê o anexo") : fail("outro prof leu anexo");
r = await as(ALUNA, `select name from storage.objects where bucket_id = 'redacoes'`);
r.rows.length === 0 ? ok("aluna não lê o anexo do aluno") : fail("aluna leu anexo alheio");
r = await as(ALUNO, `delete from storage.objects where name = $1 returning id`, [`${ALUNO}/foto.jpg`]);
r.rows.length === 0 ? ok("aluno não apaga arquivo já usado em redação") : fail("apagou anexo em uso");

// ---------------------------------------------------------------- Visibilidade
r = await as(ALUNA, `select id from public.essays`);
r.rows.length === 1 && r.rows[0].id === ESSAY ? ok("aluna vê só a própria redação") : fail(`aluna vê ${r.rows.length}`);
r = await as(PROF, `select id from public.essays`);
r.rows.length === 2 ? ok("professor vê as redações do curso (fila)") : fail(`prof vê ${r.rows.length}`);
r = await as(OUTRO_PROF, `select id from public.essays`);
r.rows.length === 0 ? ok("outro professor não vê nada") : fail("outro prof viu redações");

// ---------------------------------------------------------------- Correção
const save = (uid, essay, scores, ret = false, comments = []) =>
  as(uid, `select public.save_essay_review($1, $2, $3, $4, $5, $6) as total`, [
    essay, scores, ["Domínio da norma", "", "", "", ""], "Bom texto!", JSON.stringify(comments), ret,
  ]);

await expectError("outro professor não pega a redação", () => as(OUTRO_PROF, `select public.claim_essay($1)`, [ESSAY]), "not_allowed");
await expectError("aluna não corrige a própria redação", () => save(ALUNA, ESSAY, [200, 200, 200, 200, 200], true), "not_allowed");
await as(PROF, `select public.claim_essay($1)`, [ESSAY]);
r = await db.query(`select status, corrector_id from public.essays where id = $1`, [ESSAY]);
r.rows[0].status === "em_correcao" && r.rows[0].corrector_id === PROF ? ok("claim: em correção") : fail(`claim: ${JSON.stringify(r.rows[0])}`);

await expectError("nota fora do passo de 40", () => save(PROF, ESSAY, [100, 120, 120, 120, 120]));
await expectError("nota acima de 200", () => save(PROF, ESSAY, [240, 120, 120, 120, 120]));
await expectError("devolver sem todas as notas", () => save(PROF, ESSAY, [160, null, 120, 120, 120], true), "scores_missing");
await expectError("comentário fora do texto", () => save(PROF, ESSAY, [160, 120, 120, 120, 120], false, [{ start: 0, end: 9999, body: "x" }]), "invalid_comment_range");

r = await save(PROF, ESSAY, [160, 120, null, 120, 120], false, [{ start: 2, end: 17, body: "Ótimo começo", competency: 1 }]);
r.rows[0].total === 520 ? ok("rascunho salvo, total parcial 520") : fail(`total: ${r.rows[0].total}`);
r = await as(ALUNA, `select * from public.essay_reviews`);
r.rows.length === 0 ? ok("aluna não vê o rascunho da nota") : fail("rascunho vazou");
r = await as(ALUNA, `select * from public.essay_comments`);
r.rows.length === 0 ? ok("aluna não vê comentários do rascunho") : fail("comentários vazaram");

const xpBefore = (await db.query(`select xp from public.profiles where id = $1`, [ALUNA])).rows[0].xp;
r = await save(PROF, ESSAY, [160, 120, 160, 120, 200], true, [{ start: 2, end: 17, body: "Ótimo começo", competency: 1 }, { body: "Revise a conclusão" }]);
r.rows[0].total === 760 ? ok("devolvida com total 760") : fail(`total: ${r.rows[0].total}`);
r = await db.query(`select status, corrected_at from public.essays where id = $1`, [ESSAY]);
r.rows[0].status === "corrigida" && r.rows[0].corrected_at ? ok("status: corrigida") : fail(`status: ${r.rows[0].status}`);
const xpAfter = (await db.query(`select xp from public.profiles where id = $1`, [ALUNA])).rows[0].xp;
xpAfter - xpBefore === 50 ? ok("aluna ganha 50 XP pela correção") : fail(`XP: ${xpBefore} → ${xpAfter}`);
r = await db.query(`select reason, ref_id from public.xp_events where user_id = $1 and reason = 'redacao'`, [ALUNA]);
r.rows.length === 1 && r.rows[0].ref_id === ESSAY ? ok("xp_events com motivo 'redacao'") : fail(`xp_events: ${JSON.stringify(r.rows)}`);
await expectError("não corrige de novo depois de devolvida", () => save(PROF, ESSAY, [200, 200, 200, 200, 200], true), "already_returned");

r = await as(ALUNA, `select total, c1, c5, final_comment from public.essay_reviews where essay_id = $1`, [ESSAY]);
r.rows[0]?.total === 760 && r.rows[0].c5 === 200 ? ok("aluna vê a nota depois da devolução") : fail(`review: ${JSON.stringify(r.rows)}`);
r = await as(ALUNA, `select quote, start_offset, body from public.essay_comments where essay_id = $1 order by position`, [ESSAY]);
r.rows.length === 2 && r.rows[0].quote === "educação digita" && r.rows[1].start_offset === null
  ? ok("comentário no trecho (citação gerada pelo banco) e comentário geral")
  : fail(`comentários: ${JSON.stringify(r.rows)}`);
r = await as(ALUNO, `select * from public.essay_reviews`);
r.rows.length === 0 ? ok("aluno não vê a nota da aluna") : fail("nota alheia vazou");

await expectError("aluna não escreve nota direto", () =>
  as(ALUNA, `insert into public.essay_reviews (essay_id, course_id, c1) values ($1, $2, 200)`, [ESSAY_FOTO, CURSO]),
);
await expectError("professor não escreve nota direto (só pela função)", () =>
  as(PROF, `insert into public.essay_reviews (essay_id, course_id, c1) values ($1, $2, 200)`, [ESSAY_FOTO, CURSO]),
);

// Depois de corrigida, pode enviar outra no mesmo tema.
await submit(ALUNA, TEMA, "Segunda versão do texto.");
ok("nova redação no mesmo tema depois da correção");

await db.close();
