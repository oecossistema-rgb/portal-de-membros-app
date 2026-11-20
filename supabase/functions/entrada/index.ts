// Função "entrada": criação de senha de quem já é membro, confirmada por um código no WhatsApp do cadastro.
// Pública (sem login), porque é usada antes de a pessoa ter senha. Por isso:
//   - o código vai sempre para o WhatsApp QUE ESTÁ NO CADASTRO do membro, nunca para o número digitado;
//   - no máximo 3 códigos por hora por membro e por e-mail; 5 tentativas por código; vale 10 minutos;
//   - o código fica guardado só como hash.
// { acao: "iniciar", email, nome, whatsapp } -> { modo: "codigo", fone } | { modo: "pedido" } | { modo: "senha" }
// { acao: "confirmar", email, nome, whatsapp, senha, codigo } -> { ok: true } (cria o login já ligado ao membro)
// Segredos: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (os mesmos da "decidir-acesso").
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeHex } from "jsr:@std/encoding@1/hex";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const VALIDADE_MIN = 10, MAX_POR_HORA = 3, MAX_TENTATIVAS = 5;

// DDD + últimos 8 dígitos (ignora 55 e o 9 extra) — igual a private.fone_chave no banco.
export function foneChave(p: string | null | undefined): string | null {
  const d = (p || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : null;
}
// "(71) •••••-5632"
export function foneMascarado(p: string): string {
  const d = (p || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 ? `(${d.slice(0, 2)}) •••••-${d.slice(-4)}` : "seu WhatsApp";
}
const telefoneZapi = (p: string) => { const d = (p || "").replace(/\D/g, ""); return d.startsWith("55") && d.length >= 12 ? d : `55${d}`; };

async function hash(codigo: string, email: string, membroId: string) {
  return encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${codigo}:${email}:${membroId}`))));
}

type Membro = { id: string; nome: string; telefone_whatsapp: string | null };

// Membro ativo, sem login, que bate com o e-mail; se nenhum, com o WhatsApp (só se for exatamente um).
async function acharMembro(email: string, whatsapp: string): Promise<Membro | null> {
  const { data: livres } = await db.from("membros").select("id,nome,email,telefone_whatsapp")
    .eq("ativo", true).eq("equipe", false).is("auth_user_id", null);
  const lista = livres || [];
  const porEmail = lista.find((m) => (m.email || "").trim().toLowerCase() === email);
  if (porEmail) return porEmail;
  const chave = foneChave(whatsapp);
  if (!chave) return null;
  const porFone = lista.filter((m) => foneChave(m.telefone_whatsapp) === chave);
  return porFone.length === 1 ? porFone[0] : null;
}

async function existeLogin(email: string): Promise<boolean> {
  const { data } = await db.rpc("entrada_status", { p_email: email });
  return data === "senha";
}

async function enviarCodigo(telefone: string, codigo: string): Promise<boolean> {
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!inst || !tok || !cli) { console.error("Z-API sem credenciais"); return false; }
  const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/send-text`, {
    method: "POST", headers: { "Content-Type": "application/json", "Client-Token": cli },
    body: JSON.stringify({
      phone: telefoneZapi(telefone),
      message: `Seu código de acesso ao *Portal de Membros*: *${codigo}*\n\nVale por ${VALIDADE_MIN} minutos. Se não foi você, ignore esta mensagem.`,
    }),
  }).catch((e) => { console.error("Z-API", e); return null; });
  if (!r?.ok) { console.error("Z-API respondeu", r?.status); return false; }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  let c: { acao?: string; email?: string; nome?: string; whatsapp?: string; senha?: string; codigo?: string } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  const email = (c.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resp(400, { erro: "Digite um e-mail válido." });

  if (c.acao === "iniciar") {
    if (await existeLogin(email)) return resp(200, { modo: "senha" });
    const m = await acharMembro(email, c.whatsapp || "");
    if (!m || !foneChave(m.telefone_whatsapp)) return resp(200, { modo: "pedido" });
    const umaHora = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: porMembro }, { count: porEmail }] = await Promise.all([
      db.from("codigos_entrada").select("id", { count: "exact", head: true }).eq("membro_id", m.id).gte("criado_em", umaHora),
      db.from("codigos_entrada").select("id", { count: "exact", head: true }).eq("email", email).gte("criado_em", umaHora),
    ]);
    if ((porMembro || 0) >= MAX_POR_HORA || (porEmail || 0) >= MAX_POR_HORA)
      return resp(429, { erro: "Muitos códigos pedidos. Aguarde uma hora e tente de novo." });
    const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const { error } = await db.from("codigos_entrada").insert({
      email, membro_id: m.id, codigo_hash: await hash(codigo, email, m.id), expira_em: new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString(),
    });
    if (error) { console.error("guardar código", error.message); return resp(500, { erro: "Não foi possível gerar o código agora." }); }
    if (!(await enviarCodigo(m.telefone_whatsapp!, codigo))) return resp(502, { erro: "Não conseguimos enviar o código pelo WhatsApp agora. Tente de novo em instantes." });
    return resp(200, { modo: "codigo", fone: foneMascarado(m.telefone_whatsapp!) });
  }

  if (c.acao === "confirmar") {
    const codigo = (c.codigo || "").replace(/\D/g, "");
    const senha = c.senha || "";
    if (codigo.length !== 6) return resp(400, { erro: "Digite os 6 números do código." });
    if (senha.length < 6) return resp(400, { erro: "A senha precisa ter pelo menos 6 caracteres." });
    const { data: reg } = await db.from("codigos_entrada").select("*").eq("email", email).is("usado_em", null)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (!reg || new Date(reg.expira_em).getTime() < Date.now()) return resp(400, { erro: "Esse código expirou. Peça um novo." });
    if (reg.tentativas >= MAX_TENTATIVAS) return resp(400, { erro: "Muitas tentativas com esse código. Peça um novo." });
    if (reg.codigo_hash !== (await hash(codigo, email, reg.membro_id))) {
      await db.from("codigos_entrada").update({ tentativas: reg.tentativas + 1 }).eq("id", reg.id);
      return resp(400, { erro: "Código incorreto. Confira e tente de novo." });
    }
    await db.from("codigos_entrada").update({ usado_em: new Date().toISOString() }).eq("id", reg.id);
    if (await existeLogin(email)) return resp(409, { erro: "Esse e-mail já tem senha. Volte e entre com ela." });
    const { data: m } = await db.from("membros").select("id,email,auth_user_id,ativo").eq("id", reg.membro_id).maybeSingle();
    if (!m?.ativo || m.auth_user_id) return resp(409, { erro: "Esse cadastro já tem acesso. Fale com a administração do Ecossistema." });

    const { data: novo, error: e1 } = await db.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { nome: (c.nome || "").trim().slice(0, 120), whatsapp: (c.whatsapp || "").replace(/\D/g, "").slice(0, 15) },
    });
    if (e1 || !novo?.user) {
      console.error("criar login", e1?.message);
      const fraca = /password/i.test(e1?.message || "");
      return resp(400, { erro: fraca ? "Escolha uma senha mais forte (pelo menos 6 caracteres)." : "Não foi possível criar o acesso agora." });
    }
    const uid = novo.user.id;
    const { data: ligado, error: e2 } = await db.from("membros")
      .update({ auth_user_id: uid, ...(m.email ? {} : { email }) }).eq("id", m.id).is("auth_user_id", null).select("id");
    if (e2 || !ligado?.length) {
      console.error("ligar membro", e2?.message);
      await db.auth.admin.deleteUser(uid);
      return resp(409, { erro: "Esse cadastro já tem acesso. Fale com a administração do Ecossistema." });
    }
    // A conta nova gera um pedido automático; como já está ligada ao membro, ele não é necessário.
    await db.from("solicitacoes_acesso").delete().eq("auth_user_id", uid);
    return resp(200, { ok: true });
  }

  return resp(400, { erro: "ação inválida" });
});
