// Função "gerar-resumo": lê o onboarding de um membro, pede à IA (Claude) um resumo do perfil
// da empresa SEM dados sensíveis.
//
// Caminho AUTOMÁTICO (chamado pelo próprio banco, com o código interno no cabeçalho x-portal-interno):
//   - { membro_id }   -> quando um onboarding é concluído (pelo portal ou importado)
//   - { varredura }   -> a cada 10 minutos: quem concluiu e ficou sem resumo (ou deu erro há mais de 6 h)
//   O resumo passa por DUAS travas (regras + segunda leitura da IA). Limpo -> publica sozinho e já pede o
//   painel de oportunidades do membro. Qualquer sinal sensível (ou falha na revisão) -> fica "pendente"
//   para um administrador revisar.
// Caminho MANUAL (login do portal):
//   - administrador -> { membro_id } ou { pendentes: true }: gera rascunho para revisão (não publica sozinho)
// Segredos (cadastrados no painel do Supabase, nunca no código): ANTHROPIC_API_KEY, opcional ANTHROPIC_MODEL.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { lerRevisao, montarEntrada, montarFatos, montarPedido, SISTEMA, SISTEMA_REVISAO, validar, type Resumo } from "./regras.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELO = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const LOTE = 8; // por chamada manual, para não estourar o tempo limite da função
const LOTE_AUTO = 2; // por varredura automática

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function chamarIA(sistema: string, pedido: string, max = 1500): Promise<string> {
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) throw new Error("ANTHROPIC_API_KEY não configurada");
  let r: Response | null = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELO, max_tokens: max, system: sistema, messages: [{ role: "user", content: pedido }] }),
    });
    if (r.ok || !(r.status === 429 || r.status >= 500)) break;
    await new Promise((ok) => setTimeout(ok, 4000 * (tentativa + 1)));
  }
  if (!r!.ok) { console.error("IA erro", r!.status, (await r!.text()).slice(0, 300)); throw new Error(`API da IA respondeu ${r!.status}`); }
  const j = await r!.json();
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

// Segunda trava: a IA relê o resumo pronto. Se ela falhar, o resumo fica para revisão (nunca publica no escuro).
async function revisar(resumo: Resumo): Promise<string[]> {
  const { fatos: _f, versao: _v, ...texto } = resumo;
  try {
    const r = lerRevisao(await chamarIA(SISTEMA_REVISAO, JSON.stringify(texto), 400));
    return r.sensivel ? (r.trechos.length ? r.trechos.map((t) => `revisão da IA: ${t}`) : ["revisão da IA: possível informação sensível"]) : [];
  } catch (e) {
    console.error("revisão falhou", e);
    return ["a revisão automática não respondeu, revise antes de publicar"];
  }
}

async function chamarOportunidades(membroId: string, interno: string) {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/gerar-oportunidades`, {
    method: "POST", headers: { "content-type": "application/json", "x-portal-interno": interno },
    body: JSON.stringify({ membro_id: membroId }),
  }).catch((e) => console.error("não chamou oportunidades", e));
}

type Resultado = { membro_id: string; ok: boolean; publicado?: boolean; alertas?: string[]; erro?: string };

async function gerarPara(membroId: string, interno: string | null): Promise<Resultado> {
  const automatico = !!interno;
  const [{ data: m }, { data: o }] = await Promise.all([
    db.from("membros").select("*").eq("id", membroId).maybeSingle(),
    db.from("membros_onboarding").select("*").eq("membro_id", membroId).maybeSingle(),
  ]);
  if (!m || !o?.onboarding_concluido_em) return { membro_id: membroId, ok: false, erro: "onboarding não concluído" };
  if (m.equipe) return { membro_id: membroId, ok: false, erro: "cadastro da equipe não tem resumo" };
  // Membros antigos dispensados do onboarding (sem respostas): não há base para um resumo.
  if (String(o.onboarding_versao || "").startsWith("dispensado")) return { membro_id: membroId, ok: false, erro: "dispensado do onboarding (sem respostas)" };
  const { data: atual } = await db.from("membros_resumo").select("status,atualizado_em").eq("membro_id", membroId).maybeSingle();
  // Nunca sobrescreve um resumo já aprovado; para refazer, o admin retira o resumo antes.
  if (atual?.status === "aprovado") return { membro_id: membroId, ok: false, erro: "já aprovado" };
  // No automático: não refaz o que já espera revisão e não duplica uma geração em andamento.
  if (automatico && atual?.status === "pendente") return { membro_id: membroId, ok: false, erro: "aguardando revisão" };
  if (atual?.status === "gerando" && Date.now() - new Date(atual.atualizado_em).getTime() < 15 * 60_000)
    return { membro_id: membroId, ok: false, erro: "já está sendo gerado" };

  await db.from("membros_resumo").upsert({ membro_id: membroId, status: "gerando", erro: null, atualizado_em: new Date().toISOString() });
  try {
    const entrada = montarEntrada(m, o);
    if (entrada.length < 4) throw new Error("respostas insuficientes para um resumo");
    const { resumo, alertas } = validar(await chamarIA(SISTEMA, montarPedido(entrada)), montarFatos(m, o));
    const agora = new Date().toISOString();
    if (automatico) {
      const todos = [...alertas, ...(alertas.length ? [] : await revisar(resumo))];
      if (todos.length === 0) {
        const { error } = await db.from("membros").update({ resumo_publico: resumo, resumo_publicado_em: agora }).eq("id", membroId);
        if (error) throw new Error(error.message);
        await db.from("membros_resumo").upsert({
          membro_id: membroId, status: "aprovado", rascunho: resumo, alertas: [], modelo: MODELO, erro: null,
          gerado_em: agora, aprovado_em: agora, aprovado_por: null, atualizado_em: agora,
        });
        await chamarOportunidades(membroId, interno!);
        return { membro_id: membroId, ok: true, publicado: true };
      }
      await db.from("membros_resumo").upsert({
        membro_id: membroId, status: "pendente", rascunho: resumo, alertas: todos, modelo: MODELO, erro: null, gerado_em: agora, atualizado_em: agora,
      });
      return { membro_id: membroId, ok: true, publicado: false, alertas: todos };
    }
    await db.from("membros_resumo").upsert({
      membro_id: membroId, status: "pendente", rascunho: resumo, alertas, modelo: MODELO, erro: null, gerado_em: agora, atualizado_em: agora,
    });
    return { membro_id: membroId, ok: true, alertas };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("resumo falhou", membroId, erro);
    await db.from("membros_resumo").upsert({ membro_id: membroId, status: "erro", erro, atualizado_em: new Date().toISOString() });
    return { membro_id: membroId, ok: false, erro };
  }
}

// Quem concluiu o onboarding e está sem resumo (ou cujo último deu erro).
async function fila(automatico: boolean): Promise<string[]> {
  const { data: concl } = await db.from("membros_onboarding").select("membro_id,onboarding_versao").not("onboarding_concluido_em", "is", null);
  const { data: feitos } = await db.from("membros_resumo").select("membro_id,status,atualizado_em");
  const seisHoras = Date.now() - 6 * 3600_000, quinzeMin = Date.now() - 15 * 60_000;
  const pular = new Set((feitos || []).filter((f) => {
    const t = new Date(f.atualizado_em).getTime();
    if (f.status === "erro") return automatico && t > seisHoras; // no automático, tenta de novo só depois de 6 h
    if (f.status === "gerando") return t > quinzeMin; // travado há mais de 15 min: tenta de novo
    return true;
  }).map((f) => f.membro_id));
  const { data: eq } = await db.from("membros").select("id").or("equipe.eq.true,ativo.eq.false");
  for (const x of eq || []) pular.add(x.id);
  for (const c of concl || []) if (String(c.onboarding_versao || "").startsWith("dispensado")) pular.add(c.membro_id);
  return (concl || []).map((c) => c.membro_id).filter((id) => !pular.has(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  let corpo: { membro_id?: string; pendentes?: boolean; varredura?: boolean } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio */ }

  // Chamada interna do banco (gatilho do onboarding ou varredura agendada).
  const interno = req.headers.get("x-portal-interno");
  if (interno) {
    const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
    if (valido !== true) return resp(401, { erro: "código interno inválido" });
    if (corpo.membro_id) return resp(200, { resultados: [await gerarPara(corpo.membro_id, interno)] });
    if (corpo.varredura) {
      const ids = (await fila(true)).slice(0, LOTE_AUTO);
      const resultados = [];
      for (const id of ids) resultados.push(await gerarPara(id, interno));
      return resp(200, { resultados });
    }
    return resp(400, { erro: "informe membro_id ou varredura" });
  }

  // Chamada pelo portal: só administradores.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return resp(401, { erro: "não autenticado" });
  const { data: eu } = await db.from("membros").select("id,is_admin,ativo").eq("auth_user_id", u.user.id).maybeSingle();
  if (!eu?.ativo) return resp(403, { erro: "sem acesso" });
  if (!eu.is_admin) return resp(200, { resultados: [], aviso: "o resumo é gerado automaticamente" });

  if (corpo.membro_id) return resp(200, { resultados: [await gerarPara(corpo.membro_id, null)] });
  if (corpo.pendentes) {
    const ids = await fila(false);
    const resultados = [];
    for (const id of ids.slice(0, LOTE)) resultados.push(await gerarPara(id, null));
    return resp(200, { resultados, restantes: Math.max(ids.length - LOTE, 0) });
  }
  return resp(400, { erro: "informe membro_id ou pendentes" });
});
