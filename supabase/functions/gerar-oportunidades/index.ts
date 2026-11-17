// Função "gerar-oportunidades": monta o painel privado de oportunidades de cada membro.
// Entrada da IA: onboarding completo do PRÓPRIO membro (ele é o único que vê o resultado)
// + somente o resumo público APROVADO dos outros membros (nunca dados privados de terceiros).
// Quem chama:
//   - administrador (login do portal) -> { membro_id } ou { todos: true } (em lotes)
//   - o próprio banco (cabeçalho x-portal-interno) -> { membro_id } logo depois que o resumo do membro é publicado,
//     ou { varredura: true } a cada 10 minutos (só o que faltou para membros NOVOS).
//   Para cada membro novo são DUAS chamadas à IA, nunca mais: (1) o painel dele; (2) uma única leitura
//   que encaixa o membro novo nos painéis dos outros, sem refazer nenhum painel existente.
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

async function chamarIA(pedido: string, sistema = SISTEMA): Promise<string> {
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) throw new Error("ANTHROPIC_API_KEY não configurada");
  let r: Response | null = null;
  // Tenta de novo quando a IA está sobrecarregada ou limita a velocidade (429/529/5xx).
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELO, max_tokens: 3000, system: sistema, messages: [{ role: "user", content: pedido }], tools: [FERRAMENTA] }),
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
    db.from("membros").select("id,nome,empresa,segmento,cidade,estado,produtos_servicos,modelo_negocio,conexoes_buscadas,como_pode_contribuir,equipe").eq("id", membroId).maybeSingle(),
    db.from("membros_onboarding").select("*").eq("membro_id", membroId).maybeSingle(),
  ]);
  if (!m || !o?.onboarding_concluido_em) return { membro_id: membroId, ok: false, erro: "onboarding não concluído" };
  if (m.equipe) return { membro_id: membroId, ok: false, erro: "cadastro da equipe não tem painel" };
  const candidatos = outros.filter((x) => x.id !== membroId);
  if (candidatos.length === 0) return { membro_id: membroId, ok: false, erro: "nenhum outro membro com resumo aprovado" };

  const eu = { ...m, ...Object.fromEntries(Object.entries(o).filter(([k, v]) => !FORA.has(k) && v != null && v !== "")) };
  delete (eu as Record<string, unknown>).id;
  delete (eu as Record<string, unknown>).equipe;
  const codigos = new Map(candidatos.map((c, i) => [`M${i + 1}`, c.id]));
  const pedido = `PERFIL DELE (completo):\n${JSON.stringify(eu)}\n\nOUTROS MEMBROS (código: nome, empresa, segmento, cidade | resumo):\n` +
    candidatos.map((c, i) => `M${i + 1}: ${c.nome}, ${c.empresa}, ${c.segmento}, ${c.cidade} | ${compactar(c.resumo)}`).join("\n");

  // Se a resposta vier com defeito de formatação, pede de novo (até 3 vezes).
  let j: { oportunidades?: unknown } = {};
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const bruto = (await chamarIA(pedido)).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try { j = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1)); break; }
    catch (e) { if (tentativa === 2) throw e; }
  }
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
  await db.from("membros_painel_estado").upsert({ membro_id: membroId, gerado_em: new Date().toISOString(), tentado_em: new Date().toISOString() });
  return { membro_id: membroId, ok: true, total: novas.length };
}

// Encaixa o membro NOVO nos painéis dos outros com UMA chamada à IA. Usa só resumos públicos aprovados
// (do novo e dos outros). Não apaga nem refaz nada: só acrescenta o novo onde ele faz sentido.
const SISTEMA_REVERSO = `Um empresário NOVO entrou no Ecossistema Master Business. Você recebe o resumo dele e a lista
dos outros membros. Aponte PARA QUAIS OUTROS MEMBROS o novo é uma boa oportunidade.
Tipos, do ponto de vista do OUTRO membro:
- "cliente": o novo tem perfil de cliente para o que o outro vende.
- "ajuda": o novo oferece algo que o outro busca.
- "parceria": atendem o mesmo público sem concorrer, ou se complementam.
- "afinidade": mesma cidade, esporte ou hobby.
Regras: use só as informações dadas, não invente. "motivo": 1 frase curta (máximo 22 palavras) falando com o OUTRO membro ("você"),
explicando por que o novo membro faz sentido para ele. "forca": 3 = muito forte, 2 = boa, 1 = leve; afinidade nunca passa de 2.
Só oportunidades boas de verdade, no máximo 15. Nunca cite números financeiros. Entregue chamando a ferramenta salvar_oportunidades,
usando em "alvo" o código do OUTRO membro.`;

async function incluirNosOutros(novoId: string, outros: Outro[]) {
  const novo = outros.find((x) => x.id === novoId);
  const candidatos = outros.filter((x) => x.id !== novoId);
  if (!novo || candidatos.length === 0) return { membro_id: novoId, ok: false, erro: "sem resumo publicado ou sem outros membros" };
  const codigos = new Map(candidatos.map((c, i) => [`M${i + 1}`, c.id]));
  const pedido = `MEMBRO NOVO: ${novo.nome}, ${novo.empresa}, ${novo.segmento}, ${novo.cidade} | ${compactar(novo.resumo)}\n\n` +
    `OUTROS MEMBROS (código: nome, empresa, segmento, cidade | resumo):\n` +
    candidatos.map((c, i) => `M${i + 1}: ${c.nome}, ${c.empresa}, ${c.segmento}, ${c.cidade} | ${compactar(c.resumo)}`).join("\n");
  let j: { oportunidades?: unknown } = {};
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const bruto = (await chamarIA(pedido, SISTEMA_REVERSO)).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try { j = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1)); break; }
    catch (e) { if (tentativa === 2) throw e; }
  }
  const tipos = new Set(["cliente", "ajuda", "parceria", "afinidade"]);
  const { data: ja } = await db.from("membros_oportunidades").select("membro_id,tipo").eq("alvo_id", novoId);
  const vistos = new Set((ja || []).map((x) => `${x.membro_id}|${x.tipo}`));
  const linhas = (Array.isArray(j.oportunidades) ? j.oportunidades : []).map((x: Record<string, unknown>) => ({
    membro_id: codigos.get(String(x.alvo)) as string, alvo_id: novoId, tipo: String(x.tipo), motivo: String(x.motivo || "").trim().slice(0, 240),
    forca: Math.min(String(x.tipo) === "afinidade" ? 2 : 3, Math.max(1, Number(x.forca) || 2)),
  })).filter((x: { membro_id?: string; tipo: string; motivo: string }) => {
    const k = `${x.membro_id}|${x.tipo}`;
    if (!x.membro_id || !tipos.has(x.tipo) || !x.motivo || vistos.has(k)) return false;
    vistos.add(k); return true;
  }).slice(0, 15);
  if (linhas.length) {
    const { error } = await db.from("membros_oportunidades").insert(linhas);
    if (error) throw new Error(error.message);
  }
  await db.from("membros_painel_estado").upsert({ membro_id: novoId, incluido_nos_outros_em: new Date().toISOString() });
  return { membro_id: novoId, ok: true, incluido_em: linhas.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  let corpo: { membro_id?: string; todos?: boolean; refazer?: boolean; depois_de?: string; varredura?: boolean } = {};
  try { corpo = await req.json(); } catch { /* vazio */ }

  const interno = req.headers.get("x-portal-interno");
  if (interno) {
    const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
    if (valido !== true) return resp(401, { erro: "código interno inválido" });
    if (corpo.todos) return resp(400, { erro: "use varredura" });
  } else {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return resp(401, { erro: "não autenticado" });
    const { data: eu } = await db.from("membros").select("id,is_admin,ativo").eq("auth_user_id", u.user.id).maybeSingle();
    if (!eu?.ativo || !eu.is_admin) return resp(403, { erro: "somente administradores" });
    if (corpo.varredura) return resp(400, { erro: "varredura é só automática" });
  }

  const { data: pub } = await db.from("membros").select("id,nome,empresa,segmento,cidade,estado,resumo_publico").eq("ativo", true).eq("equipe", false).not("resumo_publico", "is", null);
  const outros: Outro[] = (pub || []).map((p) => ({ id: p.id, nome: p.nome || "", empresa: p.empresa || "", segmento: p.segmento || "",
    cidade: [p.cidade, p.estado].filter(Boolean).join("/"), resumo: p.resumo_publico as Record<string, unknown> }));

  const rodar = async (id: string) => {
    try { return await gerarPara(id, outros); }
    catch (e) {
      const erro = e instanceof Error ? e.message : String(e); console.error("oportunidades falhou", id, erro);
      await db.from("membros_painel_estado").upsert({ membro_id: id, tentado_em: new Date().toISOString() });
      return { membro_id: id, ok: false, erro };
    }
  };
  // Membro novo (chamada interna): o painel dele + encaixar ele nos painéis dos outros. Duas chamadas à IA.
  const novoCompleto = async (id: string) => {
    // Marca a tentativa já no início, para a varredura não rodar o mesmo membro ao mesmo tempo.
    await db.from("membros_painel_estado").upsert({ membro_id: id, tentado_em: new Date().toISOString() });
    const r1 = await rodar(id);
    let r2: unknown = null;
    try { r2 = await incluirNosOutros(id, outros); }
    catch (e) { const erro = e instanceof Error ? e.message : String(e); console.error("encaixe falhou", id, erro); r2 = { membro_id: id, ok: false, erro }; }
    return { painel: r1, nos_outros: r2 };
  };
  if (corpo.varredura) {
    // Só membros NOVOS: resumo publicado e (sem painel OU ainda não encaixado nos outros). Nunca refaz painel existente.
    const { data: est } = await db.from("membros_painel_estado").select("membro_id,gerado_em,tentado_em,incluido_nos_outros_em");
    type Estado = { membro_id: string; gerado_em: string | null; tentado_em: string | null; incluido_nos_outros_em: string | null };
    const estado = new Map<string, Estado>(((est || []) as Estado[]).map((e) => [e.membro_id, e]));
    const umaHora = Date.now() - 3600_000;
    const pendentes = outros.map((o) => o.id).filter((id) => {
      const e = estado.get(id);
      if (e?.gerado_em && e?.incluido_nos_outros_em) return false;
      if (e?.tentado_em && new Date(e.tentado_em).getTime() > umaHora) return false; // tentou há pouco: espera
      return true;
    });
    const resultados = [];
    for (const id of pendentes.slice(0, 1)) {
      await db.from("membros_painel_estado").upsert({ membro_id: id, tentado_em: new Date().toISOString() });
      const e = estado.get(id);
      resultados.push(e?.gerado_em ? { nos_outros: await incluirNosOutros(id, outros).catch((x) => ({ ok: false, erro: String(x) })) } : await novoCompleto(id));
    }
    return resp(200, { resultados, restantes: Math.max(pendentes.length - 1, 0) });
  }
  if (corpo.membro_id && interno) return resp(200, { resultados: [await novoCompleto(corpo.membro_id)] });
  if (corpo.membro_id) return resp(200, { resultados: [await rodar(corpo.membro_id)] });
  if (corpo.todos) {
    const { data: concl } = await db.from("membros_onboarding").select("membro_id").not("onboarding_concluido_em", "is", null).order("membro_id");
    const { data: eq } = await db.from("membros").select("id").eq("equipe", true);
    const daEquipe = new Set((eq || []).map((x) => x.id as string));
    // Sem "refazer": só monta os painéis que ainda não existem (ex.: os que deram erro).
    const { data: comPainel } = corpo.refazer ? { data: [] } : await db.from("membros_oportunidades").select("membro_id");
    const feitos = new Set((comPainel || []).map((x) => x.membro_id as string));
    const fila = (concl || []).map((c) => c.membro_id as string).filter((id) => !feitos.has(id) && !daEquipe.has(id) && (!corpo.depois_de || id > corpo.depois_de));
    const resultados = [];
    for (const id of fila.slice(0, LOTE)) resultados.push(await rodar(id));
    const ultimo = fila.slice(0, LOTE).at(-1);
    return resp(200, { resultados, restantes: Math.max(fila.length - LOTE, 0), depois_de: ultimo });
  }
  return resp(400, { erro: "informe membro_id ou todos" });
});
