// Função "galeria-miniaturas": guarda no armazenamento do portal (bucket portal-midia) uma miniatura leve de cada foto/vídeo
// da galeria do evento. Assim a grade abre rápida e nunca fica com quadrado vazio (as miniaturas do Drive vencem e às vezes falham).
// Faz por lotes; chamada pelo banco a cada 10 min até terminar (e depois só pega o que for novo).
// Entrada: { evento_id } ou { todos: true }  ->  { feitos, faltam }
import { createClient } from "jsr:@supabase/supabase-js@2";

const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const LOTE = 150, PARALELO = 12;

type Item = { id: string; t?: string; c?: string };

async function baixar(it: Item): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  const fontes = [it.t ? `${it.t}=s400` : null, `https://drive.google.com/thumbnail?id=${it.id}&sz=w400`].filter(Boolean) as string[];
  for (const u of fontes) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
      const tipo = (r.headers.get("content-type") || "").split(";")[0];
      if (r.ok && tipo.startsWith("image/")) return { bytes: new Uint8Array(await r.arrayBuffer()), tipo };
    } catch { /* tenta a próxima fonte */ }
  }
  return null;
}

async function processar(eventoId: string) {
  const { data: ev } = await db.from("eventos").select("galeria").eq("id", eventoId).maybeSingle();
  const g = ev?.galeria as { itens?: Item[] } | null;
  const itens = g?.itens || [];
  const pendentes = itens.filter((i) => !i.c).slice(0, LOTE);
  const feitos: Record<string, string> = {};
  for (let k = 0; k < pendentes.length; k += PARALELO) {
    await Promise.all(pendentes.slice(k, k + PARALELO).map(async (it) => {
      const img = await baixar(it);
      if (!img) return;
      const ext = img.tipo === "image/png" ? "png" : img.tipo === "image/webp" ? "webp" : "jpg";
      const caminho = `galeria/${eventoId}/${it.id}.${ext}`;
      const { error } = await db.storage.from("portal-midia").upload(caminho, img.bytes, { contentType: img.tipo, upsert: true, cacheControl: "31536000" });
      if (!error) feitos[it.id] = `${URL_BASE}/storage/v1/object/public/portal-midia/${caminho}`;
    }));
  }
  if (Object.keys(feitos).length) {
    // Relê antes de gravar (a galeria pode ter sido reindexada enquanto isso) e só acrescenta o campo "c".
    const { data: atual } = await db.from("eventos").select("galeria").eq("id", eventoId).maybeSingle();
    const ga = atual?.galeria as { itens?: Item[] } & Record<string, unknown>;
    const novos = (ga?.itens || []).map((i) => (feitos[i.id] ? { ...i, c: feitos[i.id] } : i));
    await db.from("eventos").update({ galeria: { ...ga, itens: novos } }).eq("id", eventoId);
  }
  return { evento: eventoId, feitos: Object.keys(feitos).length, faltam: itens.filter((i) => !i.c).length - Object.keys(feitos).length };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  const interno = req.headers.get("x-portal-interno");
  if (!interno) return resp(401, { erro: "somente chamada interna" });
  const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
  if (valido !== true) return resp(401, { erro: "código interno inválido" });
  let c: { evento_id?: string; todos?: boolean } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  if (c.evento_id) return resp(200, await processar(c.evento_id));
  if (c.todos) {
    const { data: evs } = await db.from("eventos").select("id, galeria").not("galeria", "is", null);
    const ids = (evs || []).filter((e) => ((e.galeria as { itens?: Item[] })?.itens || []).some((i) => !i.c)).map((e) => e.id);
    const r = [];
    for (const id of ids.slice(0, 2)) r.push(await processar(id));
    return resp(200, { resultados: r });
  }
  return resp(400, { erro: "informe evento_id ou todos" });
});
