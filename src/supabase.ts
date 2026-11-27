import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- Todo erro vai para a Saúde (27/11/2026) ----------
// Qualquer função do portal que responder erro, e qualquer tela que quebrar, fica registrada (sem dados pessoais:
// só o texto do erro e onde aconteceu). O mesmo erro em seguida não é enviado de novo.
const recentes = new Map<string, number>();
export function registrarErro(origem: string, mensagem: string, detalhe?: string) {
  const chave = `${origem}|${mensagem}`;
  const agora = Date.now();
  if ((recentes.get(chave) || 0) > agora - 60_000) return;
  recentes.set(chave, agora);
  supabase.rpc("registrar_erro", { p_origem: origem, p_mensagem: mensagem, p_detalhe: detalhe ?? null }).then(() => {}, () => {});
}

const invocar = supabase.functions.invoke.bind(supabase.functions);
supabase.functions.invoke = (async (nome: string, opcoes?: { body?: unknown }) => {
  const r = await invocar(nome, opcoes as never);
  if (r.error) {
    let msg = r.error.message || "erro";
    try {
      const ctx = (r.error as { context?: Response }).context;
      const j = ctx && typeof ctx.clone === "function" ? await ctx.clone().json() : null;
      if (j?.erro) msg = String(j.erro);
      if (ctx?.status) msg = `${msg} (código ${ctx.status})`;
    } catch { /* resposta sem JSON */ }
    const corpo = opcoes?.body as { acao?: string } | undefined;
    registrarErro(`função ${nome}${corpo?.acao ? ` · ${corpo.acao}` : ""}`, msg);
  }
  return r;
}) as typeof supabase.functions.invoke;

// Só o nome da tela (sem o código do link do contrato).
const tela = () => `tela ${(location.hash || "#inicio").split("/")[0]}`;
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => registrarErro(tela(), String(e.message || "erro na tela"), e.filename ? `${e.filename}:${e.lineno}` : undefined));
  window.addEventListener("unhandledrejection", (e) => {
    const m = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "erro");
    registrarErro(tela(), m);
  });
}
