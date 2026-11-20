import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// Venda de cursos: curso pago não abre de graça por nenhum caminho do cliente.
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
ok(`${files.length} migrations aplicadas`);

const PROF = "00000000-0000-0000-0000-00000000000a";
const ALUNA = "00000000-0000-0000-0000-00000000000b";
const OUTRO = "00000000-0000-0000-0000-00000000000c";
await db.exec(`insert into auth.users (id, email) values ('${PROF}', 'p@x'), ('${ALUNA}', 'a@x'), ('${OUTRO}', 'o@x');`);

async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}
async function asService(sql, params) {
  await db.exec("reset role; set role service_role;");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

const novo = async (slug, preco) => {
  const r = await as(PROF, `insert into public.courses (owner_id, slug, title, theme_color, icon, price_cents) values ($1, $2, 'Curso ' || $2, '#3B5BFD', 'abacus', $3) returning id`, [PROF, slug, preco]);
  await as(PROF, `update public.courses set status='published' where id=$1`, [r.rows[0].id]);
  return r.rows[0].id;
};
const GRATIS = await novo("gratis-aaaa1", 0);
const PAGO = await novo("pago-aaaa2", 4990);
ok("professor publica um curso grátis e um pago (R$ 49,90)");

const def = await db.query(`select price_cents, currency from public.courses where id=$1`, [GRATIS]);
def.rows[0].price_cents === 0 && def.rows[0].currency === "brl" ? ok("todo curso nasce grátis, em reais") : fail("padrão de preço");

await as(ALUNA, `select public.enroll_free($1)`, [GRATIS]);
ok("aluna se matricula grátis no curso grátis");

await expectError("enroll_free no curso pago", () => as(ALUNA, `select public.enroll_free($1)`, [PAGO]));
await expectError("insert direto em enrollments no curso pago", () =>
  as(ALUNA, `insert into public.enrollments (user_id, course_id, source) values ($1, $2, 'free')`, [ALUNA, PAGO]),
);
await expectError("aluna se dá matrícula 'stripe'", () =>
  as(ALUNA, `insert into public.enrollments (user_id, course_id, source) values ($1, $2, 'stripe')`, [ALUNA, PAGO]),
);
await expectError("aluna grava um pagamento falso", () =>
  as(ALUNA, `insert into public.payments (user_id, course_id, stripe_checkout_session_id, amount_cents, currency, status) values ($1, $2, 'cs_fake', 4990, 'brl', 'paid')`, [ALUNA, PAGO]),
);
await expectError("aluna baixa o preço do curso", () =>
  as(ALUNA, `update public.courses set price_cents=0 where id=$1 returning id`, [PAGO]).then((r) => {
    if (!r.rows.length) throw new Error("nenhuma linha (RLS)");
  }),
);
await expectError("preço negativo", () => as(PROF, `update public.courses set price_cents=-1 where id=$1`, [PAGO]));

// Redação num tema de curso pago não matricula de graça.
const TEMA = (await as(PROF, `insert into public.essay_themes (course_id, title) values ($1, 'Tema do curso pago') returning id`, [PAGO])).rows[0].id;
await expectError("redação em curso pago sem comprar", () =>
  as(ALUNA, `select public.submit_essay($1, 'Minha', 'Texto da redação', null, null)`, [TEMA]),
);
const semMatricula = await db.query(`select 1 from public.enrollments where user_id=$1 and course_id=$2`, [ALUNA, PAGO]);
semMatricula.rows.length === 0 ? ok("continua sem matrícula no curso pago") : fail("matrícula vazou");

const aula = await as(ALUNA, `select count(*)::int n from public.questions where course_id=$1`, [PAGO]);
aula.rows[0].n === 0 ? ok("sem compra, não lê as questões do curso pago") : fail("questões vazaram");

// Webhook (chave secreta = service_role) grava o pagamento e matricula.
await asService(`insert into public.payments (user_id, course_id, stripe_checkout_session_id, amount_cents, currency, status) values ($1, $2, 'cs_test_1', 4990, 'brl', 'paid')`, [ALUNA, PAGO]);
await asService(`insert into public.enrollments (user_id, course_id, source) values ($1, $2, 'stripe') on conflict do nothing`, [ALUNA, PAGO]);
ok("webhook grava pagamento e matrícula 'stripe'");

const idValido = await as(ALUNA, `select public.submit_essay($1, 'Minha', 'Texto da redação', null, null) id`, [TEMA]);
idValido.rows[0].id ? ok("depois da compra, a aluna envia a redação") : fail("redação após compra");

const minhas = await as(ALUNA, `select amount_cents from public.payments`);
minhas.rows.length === 1 && minhas.rows[0].amount_cents === 4990 ? ok("aluna vê a própria compra") : fail("compra da aluna");
const vendas = await as(PROF, `select count(*)::int n from public.payments where course_id=$1`, [PAGO]);
vendas.rows[0].n === 1 ? ok("professor vê a venda do curso dele") : fail("venda para o professor");
const alheio = await as(OUTRO, `select count(*)::int n from public.payments`);
alheio.rows[0].n === 0 ? ok("outra pessoa não vê pagamentos") : fail("pagamentos vazaram");

if (process.exitCode) console.log("\nFALHOU");
else console.log("\nVendas: tudo certo.");
