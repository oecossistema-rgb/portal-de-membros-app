// Função "gerar-oportunidades": monta o painel privado de oportunidades de cada membro.
// Entrada da IA: onboarding completo do PRÓPRIO membro (ele é o único que vê o resultado)
// + somente o resumo público APROVADO dos outros membros (nunca dados privados de terceiros).
// Quem chama: administrador -> { membro_id } ou { todos: true } (em lotes).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELO = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const LOTE = 3;
const MAX = 12;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Campos do próprio membro que NÃO entram (não ajudam a casar e são os mais sensíveis).
const FORA = new Set(["faturamento_mensal_atual", "faturamento_meta_12m", "faturamento_meta_5anos", "tamanho_equipe", "comentarios",
  "membro_id", "etapa_atual", "onboarding_versao", "onboarding_concluido_em", "criado_em", "atualizado_em"]);

const SISTEMA = `Você cruza o perfil de UM empresário com os outros membros do Ecossistema Master Business
e aponta as melhores oportunidades de negócio e conexão PARA ELE. Só ele vai ler.

Tipos:
- "cliente": o outro membro tem perfil de cliente para o que ELE vende.
- "ajuda": o outro membro oferece algo que ELE disse que busca ou precisa.
- "parceria": atendem o mesmo público sem concorrer, ou se complementam.
- "afinidade": mesma cidade, esporte ou hobby (bom para quebrar o gelo).

Regras:
- Use apenas as informações dadas. Não invente.
- "motivo": 1 frase curta (máximo 22 palavras), falando com ele ("você"), concreta, dizendo por que faz sentido.
- Sobre os OUTROS membros, use só o resumo deles. Nunca cite números financeiros de ninguém.
- "forca": 3 = muito forte, 2 = boa, 1 = leve. Afinidade nunca passa de 2.
- No máximo ${MAX} oportunidades, as melhores primeiro; no máximo 2 afinidades. Um membro pode aparecer em mais de um tipo só se for muito forte.
- Entregue o resultado chamando a ferramenta salvar_oportunidades.`;

const FERRAMENTA = {
  name: "salvar_oportunidades",
  description: "Salva as oportunidades encontradas para o empresário.",
  input_schema: {
    type: "object",
    properties: {
      oportunidades: {
        type: "array",
        items: {
          type: "object",
          properties: {
            alvo: { type: "string", description: "código do membro, ex.: M12" },
            tipo: { type: "string", enum: ["cliente", "ajuda", "parceria", "afinidade"] },
            motivo: { type: "string" },
            forca: { type: "integer", enum: [1, 2, 3] },
          },
          required: ["alvo", "tipo", "motivo", "forca"],
        },
      },
    },
    required: ["oportunidades"],
  },
};

async function chamarIA(pedido: string): Promise<string> {
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) throw new Error("ANTHROPIC_API_KEY não configurada");
  let r: Response | null = null;
  // Tenta de novo quando a IA está sobrecarregada ou limita a velocidade (429/529/5xx).
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELO, max_tokens: 3000, system: SISTEMA, messages: [{ role: "user", content: pedido }], tools: [FERRAMENTA], tool_choice: { type: "tool", name: "salvar_oportunidades" } }),
    });
    if (r.ok || !(r.status === 429 || r.status >= 500)) break;
    const espera = Number(r.headers.get("retry-after")) || 4 * (tentativa + 1);
    await new Promise((ok) => setTimeout(ok, Math.min(espera, 20) * 1000));
  }
  if (!r!.ok) {
    const corpo = (await r!.text()).slice(0, 300);
    console.error("IA erro", r!.status, corpo);
    throw new Error(`API da IA respondeu ${r!.status}`);
  }
  const j = await r!.json();
  // A resposta vem como chamada de ferramenta: o JSON já chega validado pela API.
  const uso = (j.content || []).find((c: { type: string }) => c.type === "tool_use");
  if (uso?.input) return JSON.stringify(uso.input);
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

type Outro = { id: string; nome: string; empresa: string; segmento: string; cidade: string; resumo: Record<string, unknown> };

function compactar(r: Record<string, unknown>): string {
  const l = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as { titulo?: string }).titulo)).filter(Boolean).join("; ") : "");
  const f = (r.fatos || {}) as Record<string, string>;
  return [r.frase, f.atende && `Atende: ${f.atende}`, l(r.oferece) && `Oferece: ${l(r.oferece)}`, l(r.clientes) && `Clientes: ${l(r.clientes)}`,
    l(r.busca) && `Busca: ${l(r.busca)}`, l(r.fora_do_trabalho) && `Hobbies: ${l(r.fora_do_trabalho)}`,
    // formato antigo
    r.apresentacao, r.o_que_faz].filter(Boolean).join(" | ");
}

async function gerarPara(membroId: string, outros: Outro[]) {
  const [{ data: m }, { data: o }] = await Promise.all([
    db.from("membros").select("id,nome,empresa,segmento,cidade,estado,produtos_servicos,modelo_negocio,conexoes_buscadas,como_pode_contribuir").eq("id", membroId).maybeSingle(),
    db.from("membros_onboarding").select("*").eq("membro_id", membroId).maybeSingle(),
  ]);
  if (!m || !o?.onboarding_concluido_em) return { membro_id: membroId, ok: false, erro: "onboarding não concluído" };
  const candidatos = outros.filter((x) => x.id !== membroId);
  if (candidatos.length === 0) return { membro_id: membroId, ok: false, erro: "nenhum outro membro com resumo aprovado" };

  const eu = { ...m, ...Object.fromEntries(Object.entries(o).filter(([k, v]) => !FORA.has(k) && v != null && v !== "")) };
  delete (eu as Record<string, unknown>).id;
  const codigos = new Map(candidatos.map((c, i) => [`M${i + 1}`, c.id]));
  const pedido = `PERFIL DELE (completo):\n${JSON.stringify(eu)}\n\nOUTROS MEMBROS (código: nome, empresa, segmento, cidade | resumo):\n` +
    candidatos.map((c, i) => `M${i + 1}: ${c.nome}, ${c.empresa}, ${c.segmento}, ${c.cidade} | ${compactar(c.resumo)}`).join("\n");

  const bruto = (await chamarIA(pedido)).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const j = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1));
  const tipos = new Set(["cliente", "ajuda", "parceria", "afinidade"]);
  const vistos = new Set<string>();
  const linhas = (Array.isArray(j.oportunidades) ? j.oportunidades : []).map((x: Record<string, unknown>) => ({
    membro_id: membroId, alvo_id: codigos.get(String(x.alvo)), tipo: String(x.tipo), motivo: String(x.motivo || "").trim().slice(0, 240),
    forca: Math.min(3, Math.max(1, Number(x.forca) || 2)),
  })).filter((x: { alvo_id?: string; tipo: string; motivo: string }) => {
    const k = `${x.alvo_id}|${x.tipo}`;
    if (!x.alvo_id || !tipos.has(x.tipo) || !x.motivo || vistos.has(k)) return false;
    vistos.add(k); return true;
  }).slice(0, MAX);

  // Troca as sugestões antigas não tocadas; mantém as que o membro já marcou.
  await db.from("membros_oportunidades").delete().eq("membro_id", membroId).eq("status", "nova");
  const { data: marcadas } = await db.from("membros_oportunidades").select("alvo_id,tipo").eq("membro_id", membroId);
  const ja = new Set((marcadas || []).map((x) => `${x.alvo_id}|${x.tipo}`));
  const novas = linhas.filter((x: { alvo_id: string; tipo: string }) => !ja.has(`${x.alvo_id}|${x.tipo}`));
  if (novas.length) {
    const { error } = await db.from("membros_oportunidades").insert(novas);
    if (error) throw new Error(error.message);
  }
  return { membro_id: membroId, ok: true, total: novas.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return resp(401, { erro: "não autenticado" });
  const { data: eu } = await db.from("membros").select("id,is_admin,ativo").eq("auth_user_id", u.user.id).maybeSingle();
  if (!eu?.ativo || !eu.is_admin) return resp(403, { erro: "somente administradores" });

  let corpo: { membro_id?: string; todos?: boolean; refazer?: boolean; depois_de?: string } = {};
  try { corpo = await req.json(); } catch { /* vazio */ }

  const { data: pub } = await db.from("membros").select("id,nome,empresa,segmento,cidade,estado,resumo_publico").eq("ativo", true).not("resumo_publico", "is", null);
  const outros: Outro[] = (pub || []).map((p) => ({ id: p.id, nome: p.nome || "", empresa: p.empresa || "", segmento: p.segmento || "",
    cidade: [p.cidade, p.estado].filter(Boolean).join("/"), resumo: p.resumo_publico as Record<string, unknown> }));

  const rodar = async (id: string) => {
    try { return await gerarPara(id, outros); }
    catch (e) { const erro = e instanceof Error ? e.message : String(e); console.error("oportunidades falhou", id, erro); return { membro_id: id, ok: false, erro }; }
  };
  if (corpo.membro_id) return resp(200, { resultados: [await rodar(corpo.membro_id)] });
  if (corpo.todos) {
    const { data: concl } = await db.from("membros_onboarding").select("membro_id").not("onboarding_concluido_em", "is", null).order("membro_id");
    // Sem "refazer": só monta os painéis que ainda não existem (ex.: os que deram erro).
    const { data: comPainel } = corpo.refazer ? { data: [] } : await db.from("membros_oportunidades").select("membro_id");
    const feitos = new Set((comPainel || []).map((x) => x.membro_id as string));
    const fila = (concl || []).map((c) => c.membro_id as string).filter((id) => !feitos.has(id) && (!corpo.depois_de || id > corpo.depois_de));
    const resultados = [];
    for (const id of fila.slice(0, LOTE)) resultados.push(await rodar(id));
    const ultimo = fila.slice(0, LOTE).at(-1);
    return resp(200, { resultados, restantes: Math.max(fila.length - LOTE, 0), depois_de: ultimo });
  }
  return resp(400, { erro: "informe membro_id ou todos" });
});
