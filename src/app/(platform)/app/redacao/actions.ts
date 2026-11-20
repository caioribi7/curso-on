"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { ESSAY_FILE_MAX_BYTES, ESSAY_FILE_TYPES, ESSAY_MAX_CHARS, ESSAY_MAX_LINES, countLines } from "@/lib/redacao-shared";
import type { ActionState } from "@/lib/types";

const EXT: Record<(typeof ESSAY_FILE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const ERRORS: Record<string, string> = {
  essay_pending: "Você já tem uma redação aguardando correção neste tema.",
  theme_not_available: "Este tema não está mais recebendo redações.",
  empty_essay: "Escreva o texto ou anexe uma foto/PDF.",
};

export async function submitEssay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({
      themeId: z.string().uuid(),
      title: z.string().trim().max(150).default(""),
      mode: z.enum(["texto", "arquivo"]),
    })
    .safeParse({ themeId: formData.get("themeId"), title: formData.get("title") ?? "", mode: formData.get("mode") });
  if (!parsed.success) return { error: "Requisição inválida." };
  const { themeId, title, mode } = parsed.data;
  const supabase = await createClient();

  let body: string | null = null;
  let filePath: string | null = null;
  let fileType: string | null = null;

  if (mode === "texto") {
    body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
    if (!body) return { fieldErrors: { body: ["Escreva sua redação antes de enviar."] } };
    if (body.length > ESSAY_MAX_CHARS) return { fieldErrors: { body: [`O texto passou de ${ESSAY_MAX_CHARS} caracteres.`] } };
    if (countLines(body) > ESSAY_MAX_LINES) return { fieldErrors: { body: [`O texto passou de ${ESSAY_MAX_LINES} linhas. No ENEM, o que passa da linha 30 não é lido.`] } };
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: ["Escolha uma foto ou um PDF."] } };
    if (file.size > ESSAY_FILE_MAX_BYTES) return { fieldErrors: { file: ["O arquivo passou de 5 MB."] } };
    const type = ESSAY_FILE_TYPES.find((t) => t === file.type);
    if (!type) return { fieldErrors: { file: ["Use JPG, PNG, WEBP ou PDF."] } };
    filePath = `${user.id}/${crypto.randomUUID()}.${EXT[type]}`;
    fileType = type;
    const { error } = await supabase.storage.from("redacoes").upload(filePath, file, { contentType: type, upsert: false });
    if (error) {
      console.error("[submitEssay] upload", error.message);
      return { error: "Não foi possível enviar o arquivo. Tente novamente." };
    }
  }

  const { data, error } = await supabase.rpc("submit_essay", {
    p_theme: themeId,
    p_title: title,
    p_body: body,
    p_file_path: filePath,
    p_file_type: fileType,
  });
  if (error || !data) {
    if (filePath) await supabase.storage.from("redacoes").remove([filePath]);
    const key = Object.keys(ERRORS).find((k) => error?.message.includes(k));
    return { error: key ? ERRORS[key] : "Não foi possível enviar a redação. Tente novamente." };
  }

  revalidatePath("/app/redacao");
  redirect(`/app/redacao/${data as string}?enviada=1`);
}
