// Função "planilha-onboarding": copia as respostas do onboarding feito NO PORTAL para a planilha de respostas
// do Google Forms ("Formulário de Onboarding Ecossistema Master Business! (respostas)"), aba "Respostas do portal",
// com as colunas na mesma ordem das perguntas do formulário. Sem Make: o portal fala direto com um script
// (Apps Script) publicado dentro da própria planilha.
// Chamada só pelo banco (cabeçalho x-portal-interno):
//   { membro_id }   -> quando o onboarding é concluído
//   { varredura }   -> a cada 10 minutos: reenvia o que ainda não chegou na planilha (ex.: Google fora do ar)
// Segredos (cadastrados no painel do Supabase): PLANILHA_URL (link do App da Web) e PLANILHA_CHAVE (palavra-chave
// combinada com o script). Respostas importadas do Forms e membros dispensados nunca são enviados (já estão lá).
import { createClient } from "jsr:@supabase/supabase-js@2";

const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const LOTE = 5;

type Reg = Record<string, unknown>;
const txt = (v: unknown) => v == null ? "" : Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v);
const dataBR = (iso: unknown, comHora: boolean) => {
  if (!iso) return "";
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00Z` : String(iso));
  if (isNaN(d.getTime())) return String(iso);
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", year: "numeric", ...(comHora ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : {}) }).format(d);
  return p.replace(",", "");
};

// Uma linha na ordem exata das colunas do Google Forms (A..AP).
export function montarLinha(m: Reg, o: Reg): string[] {
  const cidade = txt(o.cidade_estado) || [txt(m.cidade), txt(m.estado)].filter(Boolean).join(" / ");
  return [
    dataBR(o.onboarding_concluido_em, true), // Carimbo de data/hora
    txt(m.nome), txt(m.empresa), txt(m.segmento), cidade, txt(m.site_instagram),
    dataBR(o.data_fundacao, false), txt(m.produtos_servicos), txt(m.modelo_negocio),
    txt(o.modelo_comercial), txt(o.modelo_comercial_outro_texto || o.modelo_comercial_outros),
    txt(o.faturamento_mensal_atual), txt(o.faturamento_meta_12m), txt(o.tamanho_equipe),
    txt(o.canais_aquisicao), txt(o.canais_aquisicao_outros), txt(o.melhor_canal_hoje), txt(o.principal_gargalo),
    txt(o.avancos_12m), txt(o.visao_5anos), txt(o.faturamento_meta_5anos), txt(o.papel_5anos), txt(o.legado_missao),
    txt(o.desafios_atuais), txt(o.areas_apoio), txt(o.areas_apoio_outro), txt(o.decisoes_pendentes),
    txt(o.planejamento_anual), txt(o.perfil_gestao), txt(o.ponto_forte), txt(o.maior_limitacao),
    txt(o.grupos_mentorias), txt(o.motivacao_entrada), txt(o.expectativas),
    txt(m.conexoes_buscadas), txt(m.como_pode_contribuir), txt(o.comentarios), txt(o.esporte), txt(o.hobby),
    txt(m.foto_url), txt(m.logo_url),
    `portal:${m.id}`, // identificador (evita linha repetida)
  ];
}

const doPortal = (versao: unknown) => { const v = String(versao || ""); return !v.startsWith("importado") && !v.startsWith("dispensado"); };

async function enviar(membroId: string): Promise<{ membro_id: string; ok: boolean; erro?: string }> {
  const url = Deno.env.get("PLANILHA_URL"), chave = Deno.env.get("PLANILHA_CHAVE");
  if (!url || !chave) return { membro_id: membroId, ok: false, erro: "PLANILHA_URL/PLANILHA_CHAVE não configuradas" };
  const [{ data: m }, { data: o }] = await Promise.all([
    db.from("membros").select("*").eq("id", membroId).maybeSingle(),
    db.from("membros_onboarding").select("*").eq("membro_id", membroId).maybeSingle(),
  ]);
  if (!m || !o?.onboarding_concluido_em) return { membro_id: membroId, ok: false, erro: "onboarding não concluído" };
  if (!doPortal(o.onboarding_versao)) return { membro_id: membroId, ok: false, erro: "resposta veio do Forms (já está na planilha)" };
  if (m.equipe) return { membro_id: membroId, ok: false, erro: "cadastro da equipe" };
  try {
    // O App da Web do Google responde com um redirecionamento; o fetch segue sozinho.
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ chave, linha: montarLinha(m, o) }) });
    const corpo = await r.text();
    let j: { ok?: boolean; erro?: string } = {};
    try { j = JSON.parse(corpo); } catch { /* resposta não-JSON */ }
    if (!r.ok || !j.ok) throw new Error(j.erro || `planilha respondeu ${r.status}: ${corpo.slice(0, 120)}`);
    await db.from("membros_onboarding").update({ planilha_enviada_em: new Date().toISOString(), planilha_erro: null }).eq("membro_id", membroId);
    return { membro_id: membroId, ok: true };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("planilha", membroId, erro);
    await db.from("membros_onboarding").update({ planilha_erro: erro.slice(0, 300) }).eq("membro_id", membroId);
    return { membro_id: membroId, ok: false, erro };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  const interno = req.headers.get("x-portal-interno");
  if (!interno) return resp(401, { erro: "somente chamada interna" });
  const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
  if (valido !== true) return resp(401, { erro: "código interno inválido" });
  let c: { membro_id?: string; varredura?: boolean } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  if (c.membro_id) return resp(200, { resultados: [await enviar(c.membro_id)] });
  if (c.varredura) {
    if (!Deno.env.get("PLANILHA_URL")) return resp(200, { resultados: [], aviso: "planilha ainda não configurada" });
    const { data: fila } = await db.from("membros_onboarding").select("membro_id,onboarding_versao")
      .not("onboarding_concluido_em", "is", null).is("planilha_enviada_em", null).limit(50);
    const ids = (fila || []).filter((f) => doPortal(f.onboarding_versao)).map((f) => f.membro_id).slice(0, LOTE);
    const resultados = [];
    for (const id of ids) resultados.push(await enviar(id));
    return resp(200, { resultados });
  }
  return resp(400, { erro: "informe membro_id ou varredura" });
});
