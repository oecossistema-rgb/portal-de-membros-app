// Função "decidir-acesso": o administrador aprova ou recusa uma solicitação de acesso ao portal.
// Aprovar  -> cria (ou reativa) o cadastro de membro ligado ao login da pessoa e envia um WhatsApp
//             avisando que o perfil foi aprovado, com o link do portal.
// Recusar  -> só marca a solicitação como recusada (nenhuma mensagem é enviada).
// Entrada: { id, acao: "aprovar" | "recusar" } ou { id, acao: "reenviar" } (tenta o WhatsApp de novo).
// Checagem interna (cabeçalho x-portal-interno): { acao: "testar" } consulta a Z-API (status da instância),
// sem enviar mensagem nenhuma, para confirmar que as credenciais funcionam.
// Segredos (cadastrados no painel do Supabase, nunca no código):
//   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const PORTAL = "https://portal.oecossistemabusiness.com";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Telefone no formato que a Z-API espera: só números, com 55 na frente.
export function telefoneZapi(bruto: string): string {
  const d = (bruto || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

export function mensagemAprovacao(nome: string, email: string): string {
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "";
  return `Olá${primeiro ? `, ${primeiro}` : ""}! 🎉\n\n` +
    `Seu acesso ao *Portal de Membros do Ecossistema Master Business* foi aprovado.\n\n` +
    `👉 Entre em ${PORTAL}\n` +
    `Use o e-mail *${email}* e a senha que você criou.\n\n` +
    `No primeiro acesso, você vai preencher o seu perfil. É ele que conecta você aos outros membros e às oportunidades de negócio.\n\n` +
    `Seja bem-vindo(a) ao Ecossistema! 🚀`;
}

async function enviarWhatsApp(telefone: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!inst || !tok || !cli) return { ok: false, erro: "credenciais da Z-API não configuradas" };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": cli },
      body: JSON.stringify({ phone: telefone, message: texto }),
    });
    const corpo = await r.text();
    if (!r.ok) { console.error("Z-API", r.status, corpo.slice(0, 200)); return { ok: false, erro: `Z-API respondeu ${r.status}: ${corpo.slice(0, 120)}` }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });

  const interno = req.headers.get("x-portal-interno");
  if (interno) {
    const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
    if (valido !== true) return resp(401, { erro: "código interno inválido" });
    const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
    if (!inst || !tok || !cli) return resp(200, { credenciais: "faltando", tem: { inst: !!inst, tok: !!tok, cli: !!cli } });
    const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/status`, { headers: { "Client-Token": cli } });
    const j = await r.json().catch(() => ({}));
    return resp(200, { credenciais: "presentes", http: r.status, conectado: j.connected ?? null, celular_conectado: j.smartphoneConnected ?? null, erro: j.error ?? null });
  }

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return resp(401, { erro: "não autenticado" });
  const { data: eu } = await db.from("membros").select("id,is_admin,ativo").eq("auth_user_id", u.user.id).maybeSingle();
  if (!eu?.ativo || !eu.is_admin) return resp(403, { erro: "somente administradores" });

  let corpo: { id?: string; acao?: string } = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  if (!corpo.id || !["aprovar", "recusar", "reenviar"].includes(corpo.acao || "")) return resp(400, { erro: "informe id e acao" });

  const { data: s } = await db.from("solicitacoes_acesso").select("*").eq("id", corpo.id).maybeSingle();
  if (!s) return resp(404, { erro: "solicitação não encontrada" });
  const agora = new Date().toISOString();

  if (corpo.acao === "recusar") {
    if (s.status === "aprovada") return resp(409, { erro: "já aprovada" });
    await db.from("solicitacoes_acesso").update({ status: "recusada", decidido_em: agora, decidido_por: eu.id }).eq("id", s.id);
    return resp(200, { ok: true, status: "recusada" });
  }

  let membroId: string | null = s.membro_id;
  if (corpo.acao === "aprovar") {
    if (s.status === "aprovada") return resp(409, { erro: "já aprovada" });
    // Se já existe um cadastro com esse login ou e-mail (ex.: membro desativado), reativa; senão, cria.
    const { data: porLogin } = await db.from("membros").select("id,nome,empresa,telefone_whatsapp,email").eq("auth_user_id", s.auth_user_id).limit(1);
    const { data: porEmail } = await db.from("membros").select("id,nome,empresa,telefone_whatsapp,email").ilike("email", s.email);
    const existente = (porLogin || [])[0] || (porEmail || []).find((m) => (m.email || "").toLowerCase() === s.email.toLowerCase()) || null;
    if (existente) {
      const { error } = await db.from("membros").update({
        ativo: true, auth_user_id: s.auth_user_id, email: s.email,
        nome: existente.nome || s.nome, empresa: existente.empresa || s.empresa, telefone_whatsapp: existente.telefone_whatsapp || s.whatsapp,
      }).eq("id", existente.id);
      if (error) { console.error("reativar membro", error.message); return resp(500, { erro: `não foi possível reativar o cadastro (${error.message})` }); }
      membroId = existente.id;
    } else {
      const { data: novo, error } = await db.from("membros").insert({
        nome: s.nome, email: s.email, empresa: s.empresa, telefone_whatsapp: s.whatsapp, ativo: true, auth_user_id: s.auth_user_id, is_admin: false, equipe: false,
      }).select("id").single();
      if (error) { console.error("criar membro", error.message); return resp(500, { erro: `não foi possível criar o cadastro (${error.message})` }); }
      membroId = novo.id;
    }
    await db.from("solicitacoes_acesso").update({ status: "aprovada", decidido_em: agora, decidido_por: eu.id, membro_id: membroId }).eq("id", s.id);
  } else if (s.status !== "aprovada") {
    return resp(409, { erro: "só dá para reenviar o WhatsApp de uma solicitação aprovada" });
  }

  const w = await enviarWhatsApp(telefoneZapi(s.whatsapp), mensagemAprovacao(s.nome, s.email));
  await db.from("solicitacoes_acesso").update(w.ok ? { whatsapp_enviado_em: new Date().toISOString(), whatsapp_erro: null } : { whatsapp_erro: w.erro }).eq("id", s.id);
  return resp(200, { ok: true, status: "aprovada", membro_id: membroId, whatsapp: w.ok ? "enviado" : "falhou", whatsapp_erro: w.erro });
});
