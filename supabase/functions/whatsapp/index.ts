// Função "whatsapp" (26/11/2026): disparo em massa para membros e conversas com o membro, pelo número da Z-API do portal.
//
// Administradores (login):
//   { acao: "publico", publico }                    -> quem vai receber (e quem fica de fora, com o motivo)
//   { acao: "teste", texto, midia_url?, midia_tipo?, midia_nome? } -> manda só para o WhatsApp de quem clicou
//   { acao: "disparar", titulo, texto, publico, midia_url?, midia_tipo?, midia_nome?, agendado_para? } -> cria o disparo
//   { acao: "parar" | "retomar" | "cancelar", id }  -> controla um disparo
//   { acao: "responder", membro_id, texto }         -> responde o membro na tela de conversas
// Banco (cabeçalho x-portal-interno): { fila: true } -> envia os próximos da fila (um por vez, com intervalo aleatório).
//   { oferta_nova: id } -> avisa no grupo da equipe ("GESTÃO DE CONTRATO") que um membro publicou uma oferta.
// Integração do Kommo (cabeçalho x-portal-encaminhado): { tipo: "inbound" | "status", payload } -> cópia do que a Z-API mandou.
//   Só guarda mensagens de quem é membro do portal; o resto é descartado na hora.
// Segredos: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN; a chave da cópia fica no cofre do banco (portal_encaminhar).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-interno, x-portal-encaminhado" };
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// deno-lint-ignore no-explicit-any
type Reg = Record<string, any>;
type Publico = { tipo: "todos" | "segmento" | "nao_acessou" | "evento" | "contrato_vencendo" | "lista"; valor?: string; ids?: string[] };
type Membro = { id: string; nome: string; empresa: string | null; telefone_whatsapp: string | null; whatsapp_sem_disparo: boolean };

// ---------- utilidades ----------
export function telefoneZapi(bruto: string): string {
  const d = (bruto || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}
const fim8 = (t: string) => (t || "").replace(/\D/g, "").slice(-8);
const primeiro = (n: string) => { const p = (n || "").trim().split(/\s+/)[0] || ""; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
export function personalizar(texto: string, m: { nome: string; empresa: string | null }): string {
  return texto.replaceAll("{primeiro_nome}", primeiro(m.nome)).replaceAll("{nome}", m.nome || "").replaceAll("{empresa}", m.empresa || "");
}
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));
const inicioDoDia = () => { const s = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" }); return new Date(`${s}T00:00:00-03:00`).toISOString(); };

async function zapi(rota: string, corpo: Reg): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!inst || !tok || !cli) return { ok: false, erro: "credenciais da Z-API não configuradas" };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/${rota}`, {
      method: "POST", headers: { "Content-Type": "application/json", "Client-Token": cli }, body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, id: j.messageId || j.zaapId || j.id } : { ok: false, erro: `Z-API ${r.status}` };
  } catch (e) { return { ok: false, erro: e instanceof Error ? e.message : String(e) }; }
}
// Texto, imagem (com legenda) ou documento (com legenda).
async function enviar(telefone: string, texto: string, midia?: { url?: string | null; tipo?: string | null; nome?: string | null }) {
  const phone = telefoneZapi(telefone);
  if (phone.length < 12) return { ok: false, erro: "WhatsApp inválido" };
  if (midia?.url && midia.tipo === "imagem") return await zapi("send-image", { phone, image: midia.url, caption: texto });
  if (midia?.url && midia.tipo === "documento") {
    const ext = (midia.nome || midia.url).split("?")[0].split(".").pop()?.toLowerCase() || "pdf";
    const r = await zapi(`send-document/${ext}`, { phone, document: midia.url, fileName: midia.nome || `arquivo.${ext}` });
    if (!r.ok || !texto.trim()) return r;
    return await zapi("send-text", { phone, message: texto });
  }
  return await zapi("send-text", { phone, message: texto });
}

// Aviso no grupo da equipe (o mesmo dos contratos; o id fica em portal_config.contrato_grupo_whatsapp).
async function avisarGrupo(texto: string): Promise<{ ok: boolean; erro?: string }> {
  const { data } = await db.from("portal_config").select("valor").eq("chave", "contrato_grupo_whatsapp").maybeSingle();
  const grupo = (data?.valor || "").trim();
  if (!grupo) return { ok: false, erro: "grupo não configurado" };
  return await zapi("send-text", { phone: grupo, message: texto });
}
async function ofertaNova(id: string): Promise<Reg> {
  const { data: o } = await db.from("ofertas").select("titulo, tipo, condicao_membro, preco, membro_id").eq("id", id).maybeSingle();
  if (!o) return { ignorado: true };
  const { data: m } = await db.from("membros").select("nome, empresa").eq("id", o.membro_id).maybeSingle();
  const texto = `🛍️ *NOVA OFERTA NO PORTAL*\n\n👤 *${m?.nome || "Membro"}*${m?.empresa ? `\n🏢 ${m.empresa}` : ""}\n\n` +
    `📌 ${o.titulo} (${o.tipo === "produto" ? "produto" : "serviço"})` +
    `${o.condicao_membro ? `\n⭐ Para membros: ${o.condicao_membro}` : ""}${o.preco ? `\n💰 ${o.preco}` : ""}` +
    `\n\n👉 Ver no portal:\nhttps://portal.oecossistemabusiness.com/#ofertas`;
  return await avisarGrupo(texto);
}

async function souAdmin(req: Request): Promise<Reg | null> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: m } = await db.from("membros").select("id, nome, empresa, telefone_whatsapp, is_admin, ativo").eq("auth_user_id", u.user.id).maybeSingle();
  return m?.ativo && m.is_admin ? m : null;
}

// ---------- público ----------
async function montarPublico(p: Publico): Promise<{ recebem: Membro[]; fora: { id: string; nome: string; motivo: string }[] }> {
  const { data: todos } = await db.from("membros").select("id, nome, empresa, telefone_whatsapp, whatsapp_sem_disparo, segmento, auth_user_id, contrato_pendente")
    .eq("ativo", true).eq("equipe", false).order("nome");
  let lista = (todos || []) as (Membro & Reg)[];
  if (p.tipo === "segmento") lista = lista.filter((m) => (m.segmento || "").toLowerCase().includes(String(p.valor || "").toLowerCase()));
  if (p.tipo === "lista") { const ids = new Set(p.ids || []); lista = lista.filter((m) => ids.has(m.id)); }
  if (p.tipo === "nao_acessou") lista = lista.filter((m) => !m.auth_user_id); // ainda não criou a senha = nunca entrou
  if (p.tipo === "evento") {
    const { data: pr } = await db.from("presencas").select("user_id").eq("evento_id", p.valor || "");
    const users = new Set((pr || []).map((x: Reg) => x.user_id));
    lista = lista.filter((m) => m.auth_user_id && users.has(m.auth_user_id));
  }
  if (p.tipo === "contrato_vencendo") {
    const lim = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10); // vence em até 60 dias (ou já venceu) e sem renovação
    const { data: cs } = await db.from("contratos").select("id, membro_id, vigencia_fim").eq("status", "assinado").lte("vigencia_fim", lim);
    const { data: ren } = await db.from("contratos").select("renovacao_de").not("renovacao_de", "is", null).neq("status", "cancelado");
    const renovados = new Set((ren || []).map((r: Reg) => r.renovacao_de));
    const alvo = new Set((cs || []).filter((c: Reg) => !renovados.has(c.id)).map((c: Reg) => c.membro_id));
    lista = lista.filter((m) => alvo.has(m.id));
  }
  const recebem: Membro[] = [], fora: { id: string; nome: string; motivo: string }[] = [];
  const vistos = new Set<string>();
  for (const m of lista) {
    const f = telefoneZapi(m.telefone_whatsapp || "");
    if (m.whatsapp_sem_disparo) fora.push({ id: m.id, nome: m.nome, motivo: "pediu para não receber (SAIR)" });
    else if (f.length < 12) fora.push({ id: m.id, nome: m.nome, motivo: "sem WhatsApp válido no cadastro" });
    else if (vistos.has(fim8(f))) fora.push({ id: m.id, nome: m.nome, motivo: "mesmo WhatsApp de outro membro da lista" });
    else { vistos.add(fim8(f)); recebem.push(m); }
  }
  return { recebem, fora };
}

// ---------- fila ----------
async function fila(): Promise<Reg> {
  const inicio = Date.now();
  const { data: cfgRow } = await db.from("portal_config").select("valor").eq("chave", "whatsapp_disparo").maybeSingle();
  const cfg = { intervalo_min_seg: 20, intervalo_max_seg: 60, limite_dia: 300, ...(JSON.parse(cfgRow?.valor || "{}")) };
  const espera = () => (cfg.intervalo_min_seg + Math.random() * (cfg.intervalo_max_seg - cfg.intervalo_min_seg)) * 1000;
  const agora = new Date().toISOString();
  // Pega UM disparo e trava por 3 minutos (evita duas execuções ao mesmo tempo).
  const { data: cand } = await db.from("wa_disparos").select("id, status, agendado_para").or(`status.eq.enviando,and(status.eq.agendado,agendado_para.lte.${agora})`)
    .lte("proximo_envio_em", agora).order("criado_em").limit(1);
  const d0 = cand?.[0];
  if (!d0) return { nada: true };
  const { data: travado } = await db.from("wa_disparos").update({ proximo_envio_em: new Date(Date.now() + 180e3).toISOString(), status: "enviando" })
    .eq("id", d0.id).lte("proximo_envio_em", agora).select("*").maybeSingle();
  if (!travado) return { ocupado: true };
  const d = travado as Reg;
  if (!d.iniciado_em) await db.from("wa_disparos").update({ iniciado_em: agora }).eq("id", d.id);
  let enviados = 0, proximo = Date.now();
  while (true) {
    const { count } = await db.from("wa_envios").select("id", { count: "exact", head: true }).in("status", ["enviado", "entregue", "lido"]).gte("enviado_em", inicioDoDia());
    if ((count || 0) >= cfg.limite_dia) {
      // Limite do dia: continua amanhã às 8h.
      const s = new Date(Date.now() + 864e5).toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
      proximo = new Date(`${s}T08:00:00-03:00`).getTime();
      break;
    }
    const { data: atual } = await db.from("wa_disparos").select("status").eq("id", d.id).maybeSingle();
    if (atual?.status !== "enviando") return { parado: true, enviados };
    const { data: e } = await db.from("wa_envios").select("id, membro_id, telefone").eq("disparo_id", d.id).eq("status", "pendente").limit(1).maybeSingle();
    if (!e) {
      await db.from("wa_disparos").update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", d.id);
      return { concluido: true, enviados };
    }
    const { data: m } = await db.from("membros").select("nome, empresa, whatsapp_sem_disparo").eq("id", e.membro_id).maybeSingle();
    if (!m || m.whatsapp_sem_disparo) {
      await db.from("wa_envios").update({ status: "pulado", motivo: "pediu para não receber (SAIR)" }).eq("id", e.id);
      continue;
    }
    const texto = personalizar(d.texto, m as Membro);
    const r = await enviar(e.telefone, texto, { url: d.midia_url, tipo: d.midia_tipo, nome: d.midia_nome });
    const quando = new Date().toISOString();
    await db.from("wa_envios").update(r.ok ? { status: "enviado", zapi_id: r.id || null, enviado_em: quando } : { status: "falha", motivo: r.erro }).eq("id", e.id);
    if (r.ok) {
      await db.from("wa_mensagens").insert({ membro_id: e.membro_id, direcao: "saida", texto, midia_url: d.midia_url, midia_tipo: d.midia_tipo,
        zapi_id: r.id || null, status: "enviado", origem: "disparo", enviado_por: d.criado_por, momento: quando, lida: true });
      enviados++;
    }
    const w = espera();
    proximo = Date.now() + w;
    if (Date.now() - inicio + w > 100e3) break; // a próxima rodada (a cada minuto) continua
    await dorme(w);
  }
  await db.from("wa_disparos").update({ proximo_envio_em: new Date(proximo).toISOString() }).eq("id", d.id).eq("status", "enviando");
  return { enviados };
}

// ---------- cópia do que a Z-API mandou (via integração do Kommo) ----------
async function membroPorTelefone(phone: string): Promise<Reg | null> {
  const f = fim8(phone);
  if (f.length < 8) return null;
  const { data } = await db.from("membros").select("id, telefone_whatsapp").eq("ativo", true).eq("equipe", false).like("telefone_whatsapp", `%${f.slice(-4)}%`);
  return (data || []).find((m: Reg) => fim8(m.telefone_whatsapp || "") === f && telefoneZapi(m.telefone_whatsapp).slice(2, 4) === telefoneZapi(phone).slice(2, 4)) || null;
}
async function recebido(tipo: string, p: Reg): Promise<Reg> {
  if (tipo === "status") {
    const s = String(p?.status || "").toUpperCase();
    const ids: string[] = Array.isArray(p?.ids) ? p.ids : p?.messageId ? [p.messageId] : [];
    const quando = new Date().toISOString();
    if (!ids.length || !["RECEIVED", "READ", "PLAYED"].includes(s)) return { ignorado: true };
    const lido = s !== "RECEIVED";
    await db.from("wa_envios").update(lido ? { status: "lido", lido_em: quando } : { status: "entregue", entregue_em: quando }).in("zapi_id", ids).in("status", lido ? ["enviado", "entregue"] : ["enviado"]);
    await db.from("wa_mensagens").update({ status: lido ? "lido" : "entregue" }).in("zapi_id", ids).eq("direcao", "saida");
    return { ok: true };
  }
  if (p?.fromMe === true || p?.isGroup === true || p?.isNewsletter === true) return { ignorado: true };
  const m = await membroPorTelefone(String(p?.phone || ""));
  if (!m) return { ignorado: true }; // não é membro: nada é guardado
  const texto = p?.text?.message ?? p?.image?.caption ?? p?.document?.caption ?? p?.video?.caption ?? null;
  const midia = p?.image?.imageUrl ? { url: p.image.imageUrl, tipo: "imagem" } : p?.document?.documentUrl ? { url: p.document.documentUrl, tipo: "documento" }
    : p?.audio?.audioUrl ? { url: p.audio.audioUrl, tipo: "audio" } : p?.video?.videoUrl ? { url: p.video.videoUrl, tipo: "video" } : null;
  const momento = p?.momment ? new Date(Number(p.momment)).toISOString() : new Date().toISOString();
  const { error } = await db.from("wa_mensagens").insert({ membro_id: m.id, direcao: "entrada", texto, midia_url: midia?.url || null, midia_tipo: midia?.tipo || null,
    zapi_id: p?.messageId || null, momento });
  if (error && !/duplicate/i.test(error.message)) console.error("mensagem", error.message);
  if (texto && /^\s*sair\s*[.!]?\s*$/i.test(texto)) await db.from("membros").update({ whatsapp_sem_disparo: true }).eq("id", m.id);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  let c: Reg = {};
  try { c = await req.json(); } catch { /* vazio */ }
  try {
    // ---- cópia da Z-API pela integração do Kommo ----
    const enc = req.headers.get("x-portal-encaminhado");
    if (enc) {
      const { data: ok } = await db.rpc("encaminhar_valido", { p_token: enc });
      if (ok !== true) return resp(401, { erro: "não autorizado" });
      return resp(200, await recebido(String(c.tipo || ""), c.payload || {}));
    }
    // ---- banco (fila) ----
    const interno = req.headers.get("x-portal-interno");
    if (interno) {
      const { data: ok } = await db.rpc("token_interno_valido", { p_token: interno });
      if (ok !== true) return resp(401, { erro: "código interno inválido" });
      if (c.fila) return resp(200, await fila());
      if (c.oferta_nova) return resp(200, await ofertaNova(String(c.oferta_nova)));
      return resp(400, { erro: "pedido inválido" });
    }
    // ---- administradores ----
    const admin = await souAdmin(req);
    if (!admin) return resp(401, { erro: "somente administradores" });

    if (c.acao === "publico") {
      const p = await montarPublico(c.publico || { tipo: "todos" });
      return resp(200, { total: p.recebem.length, recebem: p.recebem.map((m) => ({ id: m.id, nome: m.nome, empresa: m.empresa })), fora: p.fora });
    }
    const midia = c.midia_url ? { url: String(c.midia_url), tipo: c.midia_tipo === "documento" ? "documento" : "imagem", nome: c.midia_nome ? String(c.midia_nome).slice(0, 120) : null } : null;
    if (c.acao === "teste") {
      if (!c.texto?.trim() && !midia) return resp(400, { erro: "escreva a mensagem" });
      if (!admin.telefone_whatsapp) return resp(409, { erro: "Seu cadastro está sem WhatsApp para receber o teste." });
      const r = await enviar(admin.telefone_whatsapp, personalizar(String(c.texto || ""), admin as Membro), midia || undefined);
      return resp(r.ok ? 200 : 502, r.ok ? { ok: true } : { erro: r.erro });
    }
    if (c.acao === "disparar") {
      const texto = String(c.texto || "").trim();
      if (!texto && !midia) return resp(400, { erro: "escreva a mensagem" });
      if (texto.length > 4000) return resp(400, { erro: "mensagem longa demais" });
      const p = await montarPublico(c.publico || { tipo: "todos" });
      if (!p.recebem.length) return resp(409, { erro: "ninguém para receber nesse público" });
      const agendado = c.agendado_para ? new Date(c.agendado_para) : null;
      if (agendado && isNaN(agendado.getTime())) return resp(400, { erro: "data do agendamento inválida" });
      const futuro = agendado && agendado.getTime() > Date.now() + 60e3;
      const { data: d, error } = await db.from("wa_disparos").insert({
        titulo: String(c.titulo || texto.slice(0, 60) || "Disparo").slice(0, 120), texto: texto || " ", midia_url: midia?.url || null, midia_tipo: midia?.tipo || null,
        midia_nome: midia?.nome || null, publico: c.publico || { tipo: "todos" }, status: futuro ? "agendado" : "enviando",
        agendado_para: futuro ? agendado!.toISOString() : null, criado_por: admin.id, proximo_envio_em: futuro ? agendado!.toISOString() : new Date().toISOString(),
      }).select("id").single();
      if (error || !d) return resp(500, { erro: error?.message || "não foi possível criar o disparo" });
      // Sem repetição: quem recebeu a mesma mensagem nas últimas 24h fica de fora.
      const desde = new Date(Date.now() - 864e5).toISOString();
      const { data: rec } = await db.from("wa_disparos").select("id").eq("texto", texto || " ").neq("id", d.id).gte("criado_em", desde);
      const jaRec = new Set<string>();
      if (rec?.length) {
        const { data: env } = await db.from("wa_envios").select("membro_id").in("disparo_id", rec.map((x) => x.id)).in("status", ["enviado", "entregue", "lido", "pendente"]);
        (env || []).forEach((x: Reg) => jaRec.add(x.membro_id));
      }
      const linhas = p.recebem.map((m) => ({ disparo_id: d.id, membro_id: m.id, telefone: telefoneZapi(m.telefone_whatsapp || ""),
        ...(jaRec.has(m.id) ? { status: "pulado", motivo: "já recebeu esta mensagem nas últimas 24h" } : {}) }));
      await db.from("wa_envios").insert(linhas);
      return resp(200, { ok: true, id: d.id, total: linhas.length, agendado: !!futuro });
    }
    if (["parar", "retomar", "cancelar"].includes(c.acao)) {
      const { data: d } = await db.from("wa_disparos").select("id, status").eq("id", c.id).maybeSingle();
      if (!d) return resp(404, { erro: "disparo não encontrado" });
      if (["concluido", "cancelado"].includes(d.status)) return resp(409, { erro: "esse disparo já terminou" });
      const novo = c.acao === "parar" ? "pausado" : c.acao === "retomar" ? "enviando" : "cancelado";
      await db.from("wa_disparos").update({ status: novo, ...(novo === "enviando" ? { proximo_envio_em: new Date().toISOString() } : {}),
        ...(novo === "cancelado" ? { concluido_em: new Date().toISOString() } : {}) }).eq("id", d.id);
      if (novo === "cancelado") await db.from("wa_envios").update({ status: "pulado", motivo: "disparo cancelado" }).eq("disparo_id", d.id).eq("status", "pendente");
      return resp(200, { ok: true, status: novo });
    }
    if (c.acao === "responder") {
      const texto = String(c.texto || "").trim();
      if (!texto && !midia) return resp(400, { erro: "escreva a mensagem" });
      const { data: m } = await db.from("membros").select("id, telefone_whatsapp").eq("id", c.membro_id).eq("ativo", true).maybeSingle();
      if (!m?.telefone_whatsapp) return resp(409, { erro: "membro sem WhatsApp no cadastro" });
      const r = await enviar(m.telefone_whatsapp, texto, midia || undefined);
      if (!r.ok) return resp(502, { erro: r.erro });
      await db.from("wa_mensagens").insert({ membro_id: m.id, direcao: "saida", texto, midia_url: midia?.url || null, midia_tipo: midia?.tipo || null,
        zapi_id: r.id || null, status: "enviado", origem: "chat", enviado_por: admin.id, lida: true });
      return resp(200, { ok: true });
    }
    return resp(400, { erro: "pedido inválido" });
  } catch (e) {
    console.error("whatsapp", e);
    return resp(500, { erro: e instanceof Error ? e.message : String(e) });
  }
});
