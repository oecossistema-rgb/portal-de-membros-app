// Função "eventos-avisos": mensagens de WhatsApp (Z-API) dos eventos com vagas limitadas.
// Chamada só pelo banco (cabeçalho x-portal-interno):
//   { tipo: "confirmado" | "promovido", evento_id, user_id }  -> na hora em que a vaga é garantida
//   { varredura: true }  -> a cada 5 min: "as vagas abriram" (para quem pediu aviso) e lembrete na véspera (para os confirmados)
// Credenciais da Z-API: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (as mesmas da aprovação de acesso).
import { createClient } from "jsr:@supabase/supabase-js@2";

const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const PORTAL = "portal.oecossistemabusiness.com";

type Evento = { id: string; titulo: string; quando: string; dia_semana: string | null; local: string | null; vagas: number | null; data_inicio: string };

export function telefoneZapi(bruto: string): string {
  const d = (bruto || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

const primeiro = (nome: string | null) => (nome || "").trim().split(/\s+/)[0] || "";
const quando = (e: Evento) => [e.quando, e.dia_semana].filter(Boolean).join(" · ");

export function mensagem(tipo: string, e: Evento, nome: string | null): string {
  const oi = primeiro(nome) ? `${primeiro(nome)}, ` : "";
  const linhaEvento = `*${e.titulo}*\n${quando(e)}${e.local ? `\n${e.local}` : ""}`;
  switch (tipo) {
    case "confirmado":
      return `*Vaga garantida.*\n\n${linhaEvento}\n\n${oi}sua presença está confirmada. Se não puder ir, cancele no portal até a véspera para liberar a vaga para quem está na fila.\n${PORTAL}`;
    case "promovido":
      return `*Abriu uma vaga e ela é sua.*\n\n${linhaEvento}\n\n${oi}você estava na fila de espera e sua presença agora está confirmada. Se não puder ir, cancele no portal até a véspera.\n${PORTAL}`;
    case "abertura":
      return `*As vagas abriram.*\n\n${linhaEvento}\n\n${oi}${e.vagas ? `são só ${e.vagas} vagas` : "as vagas são limitadas"}. Garanta a sua no portal:\n${PORTAL}`;
    case "lembrete":
      return `*É amanhã.*\n\n${linhaEvento}\n\n${oi}sua presença está confirmada. Até lá.`;
    default:
      return "";
  }
}

async function enviarTexto(telefone: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!inst || !tok || !cli) return { ok: false, erro: "credenciais da Z-API não configuradas" };
  const phone = telefoneZapi(telefone);
  if (phone.length < 12) return { ok: false, erro: "sem WhatsApp no cadastro" };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/send-text`, {
      method: "POST", headers: { "Content-Type": "application/json", "Client-Token": cli }, body: JSON.stringify({ phone, message: texto }),
    });
    return r.ok ? { ok: true } : { ok: false, erro: `z-api ${r.status}` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

async function avisar(tipo: string, e: Evento, userId: string) {
  const { data: m } = await db.from("membros").select("nome, telefone_whatsapp").eq("auth_user_id", userId).eq("ativo", true).maybeSingle();
  if (!m?.telefone_whatsapp) return { user_id: userId, ok: false, erro: "sem WhatsApp no cadastro" };
  const r = await enviarTexto(m.telefone_whatsapp, mensagem(tipo, e, m.nome));
  if (!r.ok) console.error("aviso", tipo, e.id, r.erro);
  return { user_id: userId, ...r };
}

const CAMPOS = "id, titulo, quando, dia_semana, local, vagas, data_inicio";
const hojeBahia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());
const horaBahia = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bahia", hour: "2-digit", hour12: false }).format(new Date()));
const amanha = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

async function varredura() {
  const feitos: unknown[] = [];
  const agora = new Date().toISOString();
  const hoje = hojeBahia();

  // 1) Vagas abriram: avisa quem pediu "me avise quando abrir".
  const { data: abertos } = await db.from("eventos").select(CAMPOS).eq("ativo", true).eq("inscricoes_abertas", true)
    .not("vagas_abrem_em", "is", null).lte("vagas_abrem_em", agora).is("abertura_avisada_em", null).gte("data_inicio", hoje);
  for (const e of (abertos || []) as Evento[]) {
    await db.from("eventos").update({ abertura_avisada_em: agora }).eq("id", e.id);
    const { data: lista } = await db.from("eventos_lista").select("id, user_id").eq("evento_id", e.id).eq("tipo", "aviso").is("avisado_em", null);
    for (const l of lista || []) {
      feitos.push({ tipo: "abertura", evento: e.id, ...(await avisar("abertura", e, l.user_id)) });
      await db.from("eventos_lista").update({ avisado_em: new Date().toISOString() }).eq("id", l.id);
    }
  }

  // 2) Lembrete na véspera (a partir das 9h): todos os confirmados de eventos com vagas limitadas.
  if (horaBahia() >= 9) {
    const { data: vespera } = await db.from("eventos").select(CAMPOS).eq("ativo", true).not("vagas", "is", null)
      .eq("data_inicio", amanha(hoje)).is("lembrete_enviado_em", null);
    for (const e of (vespera || []) as Evento[]) {
      await db.from("eventos").update({ lembrete_enviado_em: agora }).eq("id", e.id);
      const { data: conf } = await db.from("presencas").select("user_id").eq("evento_id", e.id);
      for (const p of conf || []) feitos.push({ tipo: "lembrete", evento: e.id, ...(await avisar("lembrete", e, p.user_id)) });
    }
  }
  return feitos;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  const interno = req.headers.get("x-portal-interno");
  if (!interno) return resp(401, { erro: "somente chamada interna" });
  const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
  if (valido !== true) return resp(401, { erro: "código interno inválido" });
  let c: { tipo?: string; evento_id?: string; user_id?: string; varredura?: boolean; previa?: boolean } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  if (c.previa) {
    // Só mostra os textos (não envia nada): para conferir as mensagens.
    const e: Evento = { id: "x", titulo: "Growth Session", quando: "16 de Dezembro de 2026", dia_semana: "Quarta-feira", local: null, vagas: 5, data_inicio: "2026-12-16" };
    return resp(200, Object.fromEntries(["confirmado", "promovido", "abertura", "lembrete"].map((t) => [t, mensagem(t, e, "Rodrigo Aureliano")])));
  }
  if (c.varredura) return resp(200, { feitos: await varredura() });
  if ((c.tipo === "confirmado" || c.tipo === "promovido") && c.evento_id && c.user_id) {
    const { data: e } = await db.from("eventos").select(CAMPOS).eq("id", c.evento_id).maybeSingle();
    if (!e) return resp(404, { erro: "evento não encontrado" });
    return resp(200, await avisar(c.tipo, e as Evento, c.user_id));
  }
  return resp(400, { erro: "pedido inválido" });
});
