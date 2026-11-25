// Função "autentique-webhook": a Autentique avisa aqui NA HORA em que alguém assina (ou recusa) um contrato.
// O aviso não é usado como verdade: ele só manda o portal conferir agora, direto na Autentique, os contratos que estão
// aguardando assinatura (mesma conferência da rotina de 10 em 10 minutos, que continua como rede de segurança).
// Segurança: se houver segredo no cofre (autentique_webhook), o aviso precisa vir assinado (HMAC-SHA256, cabeçalho
// x-autentique-signature). Avisos repetidos em menos de 15 segundos são ignorados.
// Interno (x-portal-interno): { acao: "configurar" } cadastra este endereço na Autentique e guarda o segredo no cofre.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const URL_WEBHOOK = `${Deno.env.get("SUPABASE_URL")}/functions/v1/autentique-webhook`;
const json = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
let ultima = 0;

async function hmac(segredo: string, corpo: string): Promise<{ hex: string; b64: string }> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(corpo)));
  return { hex: [...s].map((b) => b.toString(16).padStart(2, "0")).join(""), b64: btoa(String.fromCharCode(...s)) };
}
async function gql(query: string): Promise<Record<string, unknown>> {
  const r = await fetch("https://api.autentique.com.br/v2/graphql", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("AUTENTIQUE_TOKEN")}` }, body: JSON.stringify({ query }),
  });
  return await r.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "método não permitido" });
  const corpo = await req.text();

  // ---- configuração (só pelo banco) ----
  const interno = req.headers.get("x-portal-interno");
  if (interno) {
    const { data: ok } = await db.rpc("token_interno_valido", { p_token: interno });
    if (ok !== true) return json(401, { erro: "código interno inválido" });
    const c = JSON.parse(corpo || "{}");
    if (c.acao === "configurar") {
      const me = await gql("query { me { id organization { id } } }");
      // deno-lint-ignore no-explicit-any
      const org = (me as any)?.data?.me?.organization?.id;
      if (!org) return json(200, { ok: false, etapa: "organizacao", resposta: JSON.stringify(me).slice(0, 400) });
      const r = await gql(`mutation { createEndpoint(organization_id: ${org}, url: "${URL_WEBHOOK}", format: JSON, type: SIGNATURE,
        name: "Portal Ecossistema - assinaturas", events: [SIGNATURE_ACCEPTED, SIGNATURE_REJECTED]) { secret webhook_endpoint { id active events } } }`);
      // deno-lint-ignore no-explicit-any
      const seg = (r as any)?.data?.createEndpoint?.secret;
      if (seg) await db.rpc("autentique_webhook_guardar", { p_segredo: seg });
      // deno-lint-ignore no-explicit-any
      return json(200, { ok: !!seg, endpoint: (r as any)?.data?.createEndpoint?.webhook_endpoint || null, erro: seg ? null : JSON.stringify(r).slice(0, 400) });
    }
    if (c.acao === "teste") { await db.rpc("contratos_atualizar_agora"); return json(200, { ok: true }); }
    return json(400, { erro: "pedido inválido" });
  }

  // ---- aviso da Autentique ----
  const { data: segredo } = await db.rpc("autentique_webhook_segredo");
  if (segredo) {
    const recebido = (req.headers.get("x-autentique-signature") || "").trim();
    const h = await hmac(segredo as string, corpo);
    if (!recebido || (recebido.toLowerCase() !== h.hex && recebido !== h.b64)) {
      console.warn("aviso da Autentique com assinatura inválida");
      return json(401, { erro: "assinatura inválida" });
    }
  }
  if (Date.now() - ultima > 15000) {
    ultima = Date.now();
    const { error } = await db.rpc("contratos_atualizar_agora");
    if (error) console.error("atualizar contratos", error.message);
  }
  return json(200, { ok: true });
});
