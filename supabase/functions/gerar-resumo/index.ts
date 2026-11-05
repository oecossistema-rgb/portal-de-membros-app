// Função "gerar-resumo": lê o onboarding de um membro, pede à IA (Claude) um resumo do perfil
// da empresa SEM dados sensíveis e grava como RASCUNHO, que só vai ao ar após aprovação de um admin.
//
// Quem pode chamar (com o login do portal):
//   - o próprio membro, logo depois de concluir o onboarding -> { }            (gera o dele)
//   - um administrador                                         -> { membro_id } ou { pendentes: true }
// Segredos usados (cadastrados no painel do Supabase, nunca no código):
//   ANTHROPIC_API_KEY, opcional ANTHROPIC_MODEL.  SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { montarEntrada, montarFatos, montarPedido, SISTEMA, validar } from "./regras.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELO = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const LOTE = 8; // por chamada, para não estourar o tempo limite da função

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function chamarIA(pedido: string): Promise<string> {
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) throw new Error("ANTHROPIC_API_KEY não configurada");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, max_tokens: 1500, system: SISTEMA, messages: [{ role: "user", content: pedido }] }),
  });
  if (!r.ok) throw new Error(`API da IA respondeu ${r.status}`);
  const j = await r.json();
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

async function gerarPara(membroId: string): Promise<{ membro_id: string; ok: boolean; alertas?: string[]; erro?: string }> {
  const [{ data: m }, { data: o }] = await Promise.all([
    db.from("membros").select("*").eq("id", membroId).maybeSingle(),
    db.from("membros_onboarding").select("*").eq("membro_id", membroId).maybeSingle(),
  ]);
  if (!m || !o?.onboarding_concluido_em) return { membro_id: membroId, ok: false, erro: "onboarding não concluído" };
  if (m.equipe) return { membro_id: membroId, ok: false, erro: "cadastro da equipe não tem resumo" };
  // Nunca sobrescreve um resumo já aprovado; para refazer, o admin retira o resumo antes.
  const { data: atual } = await db.from("membros_resumo").select("status").eq("membro_id", membroId).maybeSingle();
  if (atual?.status === "aprovado") return { membro_id: membroId, ok: false, erro: "já aprovado" };

  await db.from("membros_resumo").upsert({ membro_id: membroId, status: "gerando", erro: null, atualizado_em: new Date().toISOString() });
  try {
    const entrada = montarEntrada(m, o);
    if (entrada.length < 4) throw new Error("respostas insuficientes para um resumo");
    const { resumo, alertas } = validar(await chamarIA(montarPedido(entrada)), montarFatos(m, o));
    await db.from("membros_resumo").upsert({
      membro_id: membroId, status: "pendente", rascunho: resumo, alertas, modelo: MODELO, erro: null,
      gerado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
    });
    return { membro_id: membroId, ok: true, alertas };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await db.from("membros_resumo").upsert({ membro_id: membroId, status: "erro", erro, atualizado_em: new Date().toISOString() });
    return { membro_id: membroId, ok: false, erro };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });

  // Quem está chamando?
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return resp(401, { erro: "não autenticado" });
  const { data: eu } = await db.from("membros").select("id,is_admin,ativo").eq("auth_user_id", u.user.id).maybeSingle();
  if (!eu?.ativo) return resp(403, { erro: "sem acesso" });

  let corpo: { membro_id?: string; pendentes?: boolean } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }

  if (!eu.is_admin) {
    // Membro comum só gera o próprio, e só uma vez (depois, só um admin).
    const { data: ja } = await db.from("membros_resumo").select("status").eq("membro_id", eu.id).maybeSingle();
    if (ja && ja.status !== "erro") return resp(200, { resultados: [], aviso: "resumo já gerado" });
    return resp(200, { resultados: [await gerarPara(eu.id)] });
  }

  if (corpo.membro_id) return resp(200, { resultados: [await gerarPara(corpo.membro_id)] });

  if (corpo.pendentes) {
    // Concluídos que ainda não têm resumo (ou cujo último deu erro), em lotes.
    const { data: concl } = await db.from("membros_onboarding").select("membro_id").not("onboarding_concluido_em", "is", null);
    const { data: feitos } = await db.from("membros_resumo").select("membro_id,status");
    const pular = new Set((feitos || []).filter((f) => f.status !== "erro").map((f) => f.membro_id));
    const { data: eq } = await db.from("membros").select("id").eq("equipe", true);
    for (const x of eq || []) pular.add(x.id);
    const fila = (concl || []).map((c) => c.membro_id).filter((id) => !pular.has(id));
    const resultados = [];
    for (const id of fila.slice(0, LOTE)) resultados.push(await gerarPara(id));
    return resp(200, { resultados, restantes: Math.max(fila.length - LOTE, 0) });
  }
  return resp(400, { erro: "informe membro_id ou pendentes" });
});
