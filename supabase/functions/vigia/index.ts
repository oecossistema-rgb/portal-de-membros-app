// Função "vigia": confere de hora em hora se as peças do portal estão funcionando (sem IA, sem custo extra).
// Cada problema vira um alerta no Painel da Administração, com "como resolver"; quando o problema some, o alerta some.
// Quem vigia o vigia: o painel mostra quando foi a última verificação e fica vermelho se ela ficar velha.
// Chamado pelo banco (x-portal-interno, rotina "vigia") ou por um administrador (botão "Verificar agora").
// Confere: rotinas do banco, chamadas internas com erro, segredos, WhatsApp (Z-API) conectado, chave da Autentique
// e documentos da Autentique usados no mês.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-interno" };
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
type Alerta = { chave: string; nivel: "erro" | "atencao"; titulo: string; detalhe?: string; como_resolver: string; aba?: string };

// O que cada rotina faz e de quanto em quanto tempo deveria rodar (minutos de tolerância).
const ROTINAS: Record<string, { nome: string; limite: number }> = {
  "contratos-verificar": { nome: "Contratos (assinaturas e planilha do contrato)", limite: 60 },
  "portal-varredura": { nome: "Resumo do membro, oportunidades e planilha do onboarding", limite: 60 },
  "eventos-avisos": { nome: "Avisos de eventos no WhatsApp", limite: 60 },
  "galeria-miniaturas": { nome: "Miniaturas das fotos dos eventos", limite: 60 },
  "youtube-sincronizar": { nome: "Vídeos do YouTube na aba Conteúdo", limite: 150 },
  "galeria-renovar": { nome: "Galerias de fotos dos eventos", limite: 240 },
  "vigia": { nome: "Vigia do portal", limite: 150 },
};
const SUPABASE_LOGS = "https://supabase.com/dashboard/project/tpsujbvwpqptrzeqcgcb/functions";

async function verificar(): Promise<{ alertas: Alerta[]; resultado: Record<string, unknown> }> {
  const alertas: Alerta[] = [];
  const resultado: Record<string, unknown> = {};

  // 1. Rotinas do banco e chamadas internas
  const { data: d, error } = await db.rpc("vigia_dados_internos");
  if (error) alertas.push({ chave: "vigia:dados", nivel: "erro", titulo: "O vigia não conseguiu ler as rotinas do banco", detalhe: error.message, como_resolver: "Peça para a equipe técnica conferir a função vigia_dados_internos no Supabase." });
  const rotinas: { nome: string; ativa: boolean; ultima: string | null; falhas_2h: number; erro: string | null }[] = d?.rotinas || [];
  resultado.rotinas = rotinas.map((r) => ({ nome: r.nome, ultima: r.ultima, falhas_2h: r.falhas_2h }));
  for (const r of rotinas) {
    const info = ROTINAS[r.nome] || { nome: r.nome, limite: 120 };
    if (!r.ativa) { alertas.push({ chave: `rotina:${r.nome}:desligada`, nivel: "erro", titulo: `Rotina desligada: ${info.nome}`, como_resolver: "Essa rotina está desativada no banco. Peça para a equipe técnica reativar (cron.job, coluna active)." }); continue; }
    const minutos = r.ultima ? (Date.now() - new Date(r.ultima).getTime()) / 60000 : Infinity;
    if (r.nome !== "vigia" && minutos > info.limite) alertas.push({ chave: `rotina:${r.nome}:parada`, nivel: "erro", titulo: `Rotina parada: ${info.nome}`, detalhe: r.ultima ? `Última execução há ${Math.round(minutos)} minutos.` : "Nunca executou.", como_resolver: "Confira no Supabase se o projeto está ativo (não pausado) e se a extensão pg_cron está ligada." });
    if (r.falhas_2h > 0) alertas.push({ chave: `rotina:${r.nome}:falhou`, nivel: "erro", titulo: `Rotina com erro: ${info.nome}`, detalhe: `${r.falhas_2h} falha(s) nas últimas 2 horas. ${r.erro || ""}`.trim(), como_resolver: "Veja a mensagem de erro. Se for passageira, some sozinha na próxima verificação; se repetir, peça para a equipe técnica olhar." });
  }
  const falhas = Number(d?.http_falhas_1h || 0);
  resultado.chamadas_com_erro_1h = falhas;
  if (falhas >= 3) alertas.push({ chave: "funcoes:erros", nivel: falhas >= 10 ? "erro" : "atencao", titulo: `${falhas} chamadas internas com erro na última hora`, detalhe: d?.http_exemplo || undefined, como_resolver: `Abra os registros das funções no Supabase (${SUPABASE_LOGS}) e veja qual função está falhando.` });

  // 2. Segredos (sem eles as integrações param)
  const faltando = ["AUTENTIQUE_TOKEN", "ZAPI_INSTANCE_ID", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"].filter((k) => !Deno.env.get(k));
  if (faltando.length) alertas.push({ chave: "segredos", nivel: "erro", titulo: "Chaves de integração faltando", detalhe: faltando.join(", "), como_resolver: "Cadastre as chaves em Supabase > Edge Functions > Secrets." });

  // 3. WhatsApp (Z-API) conectado
  const inst = Deno.env.get("ZAPI_INSTANCE_ID"), tok = Deno.env.get("ZAPI_TOKEN"), cli = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (inst && tok && cli) {
    try {
      const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/status`, { headers: { "Client-Token": cli } });
      const j = await r.json().catch(() => ({}));
      resultado.whatsapp = { http: r.status, conectado: !!j.connected, celular: j.smartphoneConnected ?? null };
      if (!r.ok) alertas.push({ chave: "whatsapp", nivel: "erro", titulo: "Não foi possível consultar o WhatsApp do portal (Z-API)", detalhe: `Z-API respondeu ${r.status}. ${j.error || j.message || ""}`.trim(), como_resolver: "Entre no painel da Z-API e confira se a instância está ativa e a assinatura em dia." });
      else if (!j.connected) alertas.push({ chave: "whatsapp", nivel: "erro", titulo: "WhatsApp do portal desconectado", detalhe: j.error || undefined, como_resolver: "Entre no painel da Z-API, abra a instância e leia o QR Code com o celular do WhatsApp do portal. Até lá, nenhuma mensagem sai." });
    } catch (e) {
      alertas.push({ chave: "whatsapp", nivel: "erro", titulo: "Z-API não respondeu", detalhe: String(e).slice(0, 200), como_resolver: "Pode ser instabilidade da Z-API. Se continuar na próxima verificação, confira o painel da Z-API." });
    }
  }

  // 4. Autentique: chave funcionando e documentos do mês
  if (Deno.env.get("AUTENTIQUE_TOKEN")) {
    try {
      const r = await fetch("https://api.autentique.com.br/v2/graphql", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("AUTENTIQUE_TOKEN")}` }, body: JSON.stringify({ query: "query { me { id } }" }),
      });
      const j = await r.json().catch(() => ({}));
      resultado.autentique = { http: r.status, ok: !!j?.data?.me?.id };
      if (!j?.data?.me?.id) alertas.push({ chave: "autentique", nivel: "erro", titulo: "A chave da Autentique não está funcionando", detalhe: (j.errors || []).map((e: { message: string }) => e.message).join("; ").slice(0, 200) || `HTTP ${r.status}`, como_resolver: "No painel da Autentique (conta do Ecossistema): Configurações > Acesso a API. Gere uma nova chave e cadastre em Supabase > Edge Functions > Secrets (AUTENTIQUE_TOKEN).", aba: "contratos" });
    } catch (e) {
      alertas.push({ chave: "autentique", nivel: "atencao", titulo: "Autentique não respondeu", detalhe: String(e).slice(0, 200), como_resolver: "Pode ser instabilidade da Autentique. Se continuar na próxima verificação, confira status.autentique.com.br." });
    }
  }
  const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(3, 0, 0, 0);
  const { count } = await db.from("contratos").select("id", { count: "exact", head: true }).not("autentique_id", "is", null).gte("enviado_em", inicioMes.toISOString());
  resultado.autentique_documentos_mes = count || 0;
  if ((count || 0) >= 8) alertas.push({ chave: "autentique:cota", nivel: "atencao", titulo: `Autentique: ${count} documentos enviados neste mês`, detalhe: "O plano grátis cobre 10 por mês; depois cada documento custa cerca de R$ 0,10.", como_resolver: "Só informativo: o portal continua funcionando. Avalie o plano se o volume crescer.", aba: "contratos" });

  return { alertas, resultado };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  const interno = req.headers.get("x-portal-interno");
  if (interno) {
    const { data: ok } = await db.rpc("token_interno_valido", { p_token: interno });
    if (ok !== true) return resp(401, { erro: "código interno inválido" });
  } else {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: null };
    if (!u?.user) return resp(401, { erro: "não autenticado" });
    const { data: m } = await db.from("membros").select("is_admin, ativo").eq("auth_user_id", u.user.id).maybeSingle();
    if (!m?.ativo || !m.is_admin) return resp(403, { erro: "somente administradores" });
  }
  try {
    const { alertas, resultado } = await verificar();
    const { error } = await db.rpc("vigia_registrar", { p_alertas: alertas, p_resultado: resultado });
    if (error) return resp(500, { erro: error.message });
    return resp(200, { ok: true, alertas: alertas.length });
  } catch (e) {
    console.error("vigia", e);
    return resp(500, { erro: e instanceof Error ? e.message : String(e) });
  }
});
