// Função "decidir-acesso": o administrador aprova ou recusa uma solicitação de acesso ao portal.
// Aprovar  -> cria (ou reativa) o cadastro de membro ligado ao login da pessoa e envia pelo WhatsApp
//             o cartão de membro com o nome dela + legenda curta com o portal (aprovado em 19/11)
//             (se a imagem falhar, envia a mensagem só de texto).
// Recusar  -> só marca a solicitação como recusada (nenhuma mensagem é enviada).
// Entrada: { id, acao: "aprovar" | "recusar" } ou { id, acao: "reenviar" } (tenta o WhatsApp de novo)
//          ou { id, acao: "vincular", membro_id } ("É ele": liga o login ao perfil que já existe, sem duplicar).
// Checagem interna (cabeçalho x-portal-interno): { acao: "testar" } consulta a Z-API (status da instância),
// sem enviar mensagem nenhuma, para confirmar que as credenciais funcionam.
// Segredos (cadastrados no painel do Supabase, nunca no código):
//   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import { svgCartaoFinal, svgMembroFinal } from "./cartao.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const PORTAL = "https://portal.oecossistemabusiness.com";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Cartão de boas-vindas (imagem 3D com o nome). O fundo fixo está publicado no portal; aqui só se escreve o nome.
let pronto: Promise<{ fonte: Uint8Array; fundo: string }> | null = null;
function recursosCartao() {
  if (!pronto) pronto = (async () => {
    const [wasm, fonte, fundo] = await Promise.all([
      fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm"),
      fetch("https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_800ExtraBold.ttf").then((r) => r.arrayBuffer()),
      fetch(`${PORTAL}/cartao-fundo.png`).then((r) => { if (!r.ok) throw new Error(`fundo ${r.status}`); return r.arrayBuffer(); }),
    ]);
    await initWasm(wasm);
    return { fonte: new Uint8Array(fonte), fundo: encodeBase64(new Uint8Array(fundo)) };
  })().catch((e) => { pronto = null; throw e; });
  return pronto;
}
async function gerarCartao(nome: string): Promise<string> {
  const { fonte, fundo } = await recursosCartao();
  const png = new Resvg(svgCartaoFinal(nome, fundo), { font: { fontBuffers: [fonte], defaultFontFamily: "Inter", loadSystemFonts: false } }).render().asPng();
  return `data:image/png;base64,${encodeBase64(png)}`;
}

// Cartão de membro (modelo escolhido): fundo publicado no portal + nome em Inter SemiBold.
let prontoMembro: Promise<{ fonte: Uint8Array; fundo: string }> | null = null;
function recursosMembro() {
  if (!prontoMembro) prontoMembro = (async () => {
    await recursosCartao(); // garante o wasm iniciado
    const [fonte, fundo] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_600SemiBold.ttf").then((r) => r.arrayBuffer()),
      fetch(`${PORTAL}/cartao-membro-fundo.png`).then((r) => { if (!r.ok) throw new Error(`fundo ${r.status}`); return r.arrayBuffer(); }),
    ]);
    return { fonte: new Uint8Array(fonte), fundo: encodeBase64(new Uint8Array(fundo)) };
  })().catch((e) => { prontoMembro = null; throw e; });
  return prontoMembro;
}
async function gerarCartaoMembro(nome: string): Promise<string> {
  const { fonte, fundo } = await recursosMembro();
  const png = new Resvg(svgMembroFinal(nome, fundo), { font: { fontBuffers: [fonte], defaultFontFamily: "Inter", loadSystemFonts: false } }).render().asPng();
  return `data:image/png;base64,${encodeBase64(png)}`;
}

// Envio novo: cartão de membro + legenda curta com o link. (O envio com botão existe só para teste: em 19/11 a Z-API
// aceitou, mas a mensagem com botão não chegou ao celular.) Se a imagem falhar, vai o texto.
export const LEGENDA_CURTA = "*Seu acesso está liberado.*\nEntre com seu e-mail e senha em portal.oecossistemabusiness.com";
async function enviarCartaoMembro(telefone: string, nome: string, email: string, comBotao = false): Promise<{ ok: boolean; erro?: string; tipo?: string }> {
  try {
    const imagem = await gerarCartaoMembro(nome);
    const b = !comBotao ? { ok: false, erro: "sem botão" } : await enviarZapi("send-button-actions", {
      phone: telefone, image: imagem, message: "Entre com o e-mail e a senha que você cadastrou.", footer: "Ecossistema Master Business",
      buttonActions: [{ id: "1", type: "URL", url: PORTAL, label: "Acessar o portal" }],
    });
    if (b.ok) return { ...b, tipo: "cartao_botao" };
    if (comBotao) console.error("botão recusado, indo para cartão com legenda", b.erro);
    const i = await enviarZapi("send-image", { phone: telefone, image: imagem, caption: LEGENDA_CURTA });
    if (i.ok) return { ...i, tipo: "cartao_legenda" };
  } catch (e) {
    console.error("cartão de membro não gerado, indo para texto", e instanceof Error ? e.message : e);
  }
  const t = await enviarZapi("send-text", { phone: telefone, message: mensagemAprovacao(nome, email) });
  return { ...t, tipo: "texto" };
}

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

export function legendaCartao(nome: string, email: string): string {
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "";
  const p = primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
  return `Olá${p ? `, ${p}` : ""}! 🎉 Seu acesso ao *Portal de Membros* foi aprovado.\n\n` +
    `👉 ${PORTAL}\n\n` +
    `Entre com o e-mail *${email}* e a senha que você criou. No primeiro acesso, você preenche o seu perfil.`;
}

// Envia o cartão (imagem + legenda). Se a imagem falhar, cai para a mensagem só de texto.
async function enviarAprovacao(telefone: string, nome: string, email: string): Promise<{ ok: boolean; erro?: string; tipo?: string }> {
  try {
    const imagem = await gerarCartao(nome);
    const r = await enviarZapi("send-image", { phone: telefone, image: imagem, caption: legendaCartao(nome, email) });
    if (r.ok) return { ...r, tipo: "cartao" };
    console.error("cartão não enviado, indo para texto", r.erro);
  } catch (e) {
    console.error("cartão não gerado, indo para texto", e instanceof Error ? e.message : e);
  }
  const t = await enviarZapi("send-text", { phone: telefone, message: mensagemAprovacao(nome, email) });
  return { ...t, tipo: "texto" };
}

async function enviarZapi(rota: string, dados: Record<string, unknown>): Promise<{ ok: boolean; erro?: string }> {
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!inst || !tok || !cli) return { ok: false, erro: "credenciais da Z-API não configuradas" };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": cli },
      body: JSON.stringify(dados),
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
    let ci: { acao?: string; nome?: string; telefone?: string; formato?: string } = {};
    try { ci = await req.json(); } catch { /* vazio */ }
    if (ci.acao === "cartao") {
      // Gera o cartão no servidor, sem enviar nada: confere que imagem, fonte e fundo estão funcionando.
      const t0 = Date.now();
      try { const img = await gerarCartao(ci.nome || "Teste"); return resp(200, { cartao: "ok", bytes: Math.round(img.length * 0.75), ms: Date.now() - t0 }); }
      catch (e) { return resp(200, { cartao: "falhou", erro: e instanceof Error ? e.message : String(e) }); }
    }
    if (ci.acao === "teste_envio") {
      // Teste do envio novo para um número informado (usado só pela equipe, pelo banco).
      if (!ci.telefone) return resp(400, { erro: "informe telefone" });
      const t0 = Date.now();
      const w = await enviarCartaoMembro(telefoneZapi(ci.telefone), ci.nome || "Membro", "", ci.formato === "botao");
      return resp(200, { ...w, ms: Date.now() - t0 });
    }
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

  let corpo: { id?: string; acao?: string; membro_id?: string } = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  if (!corpo.id || !["aprovar", "recusar", "reenviar", "vincular"].includes(corpo.acao || "")) return resp(400, { erro: "informe id e acao" });
  if (corpo.acao === "vincular" && !corpo.membro_id) return resp(400, { erro: "informe o membro" });

  const { data: s } = await db.from("solicitacoes_acesso").select("*").eq("id", corpo.id).maybeSingle();
  if (!s) return resp(404, { erro: "solicitação não encontrada" });
  const agora = new Date().toISOString();

  if (corpo.acao === "recusar") {
    if (s.status === "aprovada") return resp(409, { erro: "já aprovada" });
    await db.from("solicitacoes_acesso").update({ status: "recusada", decidido_em: agora, decidido_por: eu.id }).eq("id", s.id);
    return resp(200, { ok: true, status: "recusada" });
  }

  let membroId: string | null = s.membro_id;
  if (corpo.acao === "vincular") {
    if (s.status === "aprovada") return resp(409, { erro: "já aprovada" });
    // "É ele": o login do pedido passa a ser o do membro escolhido (perfil, resumo e oportunidades continuam).
    const { data: alvo } = await db.from("membros").select("id,email,telefone_whatsapp,empresa,auth_user_id").eq("id", corpo.membro_id!).maybeSingle();
    if (!alvo) return resp(404, { erro: "membro não encontrado" });
    if (alvo.auth_user_id && alvo.auth_user_id !== s.auth_user_id) return resp(409, { erro: "esse membro já tem outro login" });
    const { data: outro } = await db.from("membros").select("id").eq("auth_user_id", s.auth_user_id).neq("id", alvo.id).limit(1);
    if (outro?.length) return resp(409, { erro: "esse login já está ligado a outro cadastro" });
    const { error } = await db.from("membros").update({
      ativo: true, auth_user_id: s.auth_user_id,
      email: alvo.email || s.email, telefone_whatsapp: alvo.telefone_whatsapp || s.whatsapp, empresa: alvo.empresa || s.empresa,
    }).eq("id", alvo.id);
    if (error) { console.error("vincular membro", error.message); return resp(500, { erro: `não foi possível ligar ao cadastro (${error.message})` }); }
    membroId = alvo.id;
    await db.from("solicitacoes_acesso").update({ status: "aprovada", decidido_em: agora, decidido_por: eu.id, membro_id: membroId }).eq("id", s.id);
  } else if (corpo.acao === "aprovar") {
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
        nome: s.nome, email: s.email, empresa: s.empresa || null, telefone_whatsapp: s.whatsapp || null, ativo: true, auth_user_id: s.auth_user_id, is_admin: false, equipe: false,
      }).select("id").single();
      if (error) { console.error("criar membro", error.message); return resp(500, { erro: `não foi possível criar o cadastro (${error.message})` }); }
      membroId = novo.id;
    }
    await db.from("solicitacoes_acesso").update({ status: "aprovada", decidido_em: agora, decidido_por: eu.id, membro_id: membroId }).eq("id", s.id);
  } else if (s.status !== "aprovada") {
    return resp(409, { erro: "só dá para reenviar o WhatsApp de uma solicitação aprovada" });
  }

  if (!s.whatsapp) return resp(200, { ok: true, status: "aprovada", membro_id: membroId, whatsapp: "sem_numero" });
  const w = await enviarCartaoMembro(telefoneZapi(s.whatsapp), s.nome, s.email);
  await db.from("solicitacoes_acesso").update(w.ok ? { whatsapp_enviado_em: new Date().toISOString(), whatsapp_erro: null } : { whatsapp_erro: w.erro }).eq("id", s.id);
  return resp(200, { ok: true, status: "aprovada", membro_id: membroId, whatsapp: w.ok ? "enviado" : "falhou", formato: w.tipo, whatsapp_erro: w.erro });
});
