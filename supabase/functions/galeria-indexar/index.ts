// Função "galeria-indexar": lê as pastas do Google Drive de um evento (compartilhadas por link) e monta o índice
// da galeria do portal, separando FOTOS e VÍDEOS por dia, com o crédito de quem fez (nome da pasta).
// Nada é movido nem alterado no Drive: só lemos a listagem pública da pasta.
// Quem chama: administrador logado (botão "Atualizar galeria") ou o banco (cabeçalho x-portal-interno).
// Entrada: { evento_id }  ->  grava em eventos.galeria.itens = [{ id, nome, tipo: "foto"|"video", dia, credito, t }]
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-interno" };
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Item = { id: string; nome: string; tipo: "foto" | "video"; dia: string; credito: string; t?: string };
const VIDEO = /\.(mov|mp4|m4v|avi|mkv|webm|3gp)$/i;
const FOTO = /\.(jpe?g|png|heic|heif|webp|gif|tiff?|dng|cr2|nef|arw)$/i;

// Lista os arquivos (e subpastas) de uma pasta pública pelo "embeddedfolderview" do Drive.
async function listar(pastaId: string): Promise<{ arquivos: { id: string; nome: string; t: string }[]; pastas: { id: string; nome: string }[] }> {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${pastaId}&hl=en`, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US" } });
  if (!r.ok) throw new Error(`Drive respondeu ${r.status} para a pasta ${pastaId}`);
  const html = await r.text();
  const arquivos: { id: string; nome: string; t: string }[] = [], pastas: { id: string; nome: string }[] = [];
  // Cada entrada vai de um "flip-entry" até o próximo.
  const blocos = html.split('<div class="flip-entry" id="entry-').slice(1);
  for (const b of blocos) {
    const id = b.slice(0, b.indexOf('"'));
    const href = /<a href="([^"]+)"/.exec(b)?.[1] || "";
    const nome = (/<div class="flip-entry-title">([^<]*)<\/div>/.exec(b)?.[1] || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    // Miniatura pronta do Drive (rápida, vem do servidor de imagens do Google). Guardamos sem o tamanho (=s190).
    const t = (/<div class="flip-entry-thumb"><img src="([^"]+)"/.exec(b)?.[1] || "").replace(/&amp;/g, "&").replace(/=s\d+(-[a-z0-9-]+)?$/i, "");
    if (href.includes("/folders/")) pastas.push({ id, nome }); else arquivos.push({ id, nome, t });
  }
  return { arquivos, pastas };
}

async function indexarPasta(pastaId: string, dia: string, credito: string, prof = 0): Promise<Item[]> {
  const { arquivos, pastas } = await listar(pastaId);
  const itens: Item[] = [];
  for (const a of arquivos) {
    const tipo = VIDEO.test(a.nome) ? "video" : FOTO.test(a.nome) ? "foto" : null;
    if (tipo) itens.push({ id: a.id, nome: a.nome, tipo, dia, credito, ...(a.t.includes("googleusercontent") ? { t: a.t } : {}) });
  }
  if (prof < 2) for (const p of pastas) itens.push(...await indexarPasta(p.id, dia, credito, prof + 1));
  return itens;
}

async function autorizado(req: Request): Promise<boolean> {
  const interno = req.headers.get("x-portal-interno");
  if (interno) { const { data } = await db.rpc("token_interno_valido", { p_token: interno }); return data === true; }
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return false;
  const { data: m } = await db.from("membros").select("is_admin").eq("auth_user_id", u.user.id).eq("ativo", true).maybeSingle();
  return !!m?.is_admin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  if (!(await autorizado(req))) return resp(401, { erro: "somente administradores" });
  let c: { evento_id?: string; todos?: boolean } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  if (c.todos) {
    // Renovação periódica: as miniaturas rápidas do Drive vencem com o tempo; reindexa todos os eventos com galeria.
    const { data: evs } = await db.from("eventos").select("id, galeria").not("galeria", "is", null);
    const ids = (evs || []).filter((e) => (e.galeria as { dias?: unknown[] })?.dias?.length).map((e) => e.id);
    for (const id of ids) await fetch(req.url, { method: "POST", headers: { "Content-Type": "application/json", "x-portal-interno": req.headers.get("x-portal-interno") || "" }, body: JSON.stringify({ evento_id: id }) });
    return resp(200, { reindexados: ids });
  }
  if (!c.evento_id) return resp(400, { erro: "informe evento_id" });
  const { data: ev, error: e0 } = await db.from("eventos").select("id, galeria").eq("id", c.evento_id).maybeSingle();
  if (e0) return resp(500, { erro: e0.message });
  const g = ev?.galeria as { dias: { titulo: string; pastas: { id: string; nome: string }[] }[] } | null;
  if (!g?.dias?.length) return resp(400, { erro: "evento sem pastas de galeria", evento: c.evento_id, achou: !!ev });
  const itens: Item[] = [];
  const resumo: Record<string, { fotos: number; videos: number }> = {};
  for (const d of g.dias) for (const p of d.pastas) {
    const its = await indexarPasta(p.id, d.titulo, p.nome);
    itens.push(...its);
    resumo[`${d.titulo} · ${p.nome}`] = { fotos: its.filter((i) => i.tipo === "foto").length, videos: its.filter((i) => i.tipo === "video").length };
  }
  // Regra do dia: o que está num dia fica nesse dia. Se o mesmo arquivo aparece de novo num dia seguinte
  // (Dia 2 ou Dia 3), ele não é repetido, não importa quem fez.
  let repetidos = 0;
  const vistos = new Map<string, Item>();
  const diaDe = new Map<string, string>();
  const conflitos: Record<string, number> = {};
  const noDia = new Set<string>();
  for (const it of itens) {
    const arquivo = `${it.tipo}|${it.nome.toLowerCase()}`;
    const primeiroDia = diaDe.get(arquivo);
    if (primeiroDia && primeiroDia !== it.dia) { repetidos++; const k = `${primeiroDia} repetido no ${it.dia}`; conflitos[k] = (conflitos[k] || 0) + 1; continue; }
    // Mesma foto em dois formatos (ex.: IMG_10.HEIC e IMG_10.JPG) ou enviada duas vezes no mesmo dia: mostra uma só.
    const base = `${it.dia}|${it.credito}|${it.tipo}|${it.nome.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/\s*\(\d+\)$/, "")}`;
    if (noDia.has(base)) { repetidos++; continue; }
    noDia.add(base);
    diaDe.set(arquivo, it.dia);
    vistos.set(`${it.id}`, it);
  }
  const final = [...vistos.values()];
  final.sort((a, b) => a.dia.localeCompare(b.dia) || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  const porDia: Record<string, { fotos: number; videos: number }> = {};
  for (const it of final) { const k = `${it.dia} · ${it.credito}`; porDia[k] ||= { fotos: 0, videos: 0 }; porDia[k][it.tipo === "foto" ? "fotos" : "videos"]++; }
  const { error } = await db.from("eventos").update({ galeria: { ...g, itens: final, conflitos, indexado_em: new Date().toISOString() } }).eq("id", ev!.id);
  if (error) return resp(500, { erro: error.message });
  return resp(200, { total: final.length, fotos: final.filter((i) => i.tipo === "foto").length, videos: final.filter((i) => i.tipo === "video").length,
    repetidos_removidos: repetidos, conflitos, nas_pastas: resumo, na_galeria: porDia });
});
