// Função "importar-imagens": guarda no armazenamento do portal (bucket fotos-membros) as fotos e logos dos membros
// que vieram do Google Forms, e troca no cadastro o link do Drive (que não abre como imagem) pela imagem guardada.
// Só chamada interna (cabeçalho x-portal-interno). Entrada: { chave, itens: [{ membro_id, tipo: "foto" | "logo", url }] }.
// Cada url aponta para a imagem CRIPTOGRAFADA (AES-GCM: 12 bytes de nonce + conteúdo) num link temporário;
// só quem tem a chave (enviada nesta chamada, nunca guardada) consegue abrir. O link é apagado depois.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";

async function abrir(cifrado: Uint8Array, chave: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: cifrado.slice(0, 12) }, chave, cifrado.slice(12)));
}

const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Item = { membro_id: string; tipo: "foto" | "logo"; url: string };

async function importar(it: Item, chave: CryptoKey) {
  if (!["foto", "logo"].includes(it.tipo)) return { ...it, ok: false, erro: "tipo inválido" };
  const r = await fetch(it.url);
  if (!r.ok) return { membro_id: it.membro_id, tipo: it.tipo, ok: false, erro: `download ${r.status}` };
  const bytes = await abrir(new Uint8Array(await r.arrayBuffer()), chave);
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const caminho = `importadas/${it.membro_id}/${it.tipo}-${Date.now()}.${png ? "png" : "jpg"}`;
  const { error: e1 } = await db.storage.from("fotos-membros").upload(caminho, bytes, { contentType: png ? "image/png" : "image/jpeg", upsert: true, cacheControl: "31536000" });
  if (e1) return { membro_id: it.membro_id, tipo: it.tipo, ok: false, erro: e1.message };
  const publico = `${URL_BASE}/storage/v1/object/public/fotos-membros/${caminho}`;
  const { error: e2 } = await db.from("membros").update(it.tipo === "foto" ? { foto_url: publico } : { logo_url: publico }).eq("id", it.membro_id);
  if (e2) return { membro_id: it.membro_id, tipo: it.tipo, ok: false, erro: e2.message };
  return { membro_id: it.membro_id, tipo: it.tipo, ok: true, bytes: bytes.length };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  const interno = req.headers.get("x-portal-interno");
  if (!interno) return resp(401, { erro: "somente chamada interna" });
  const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
  if (valido !== true) return resp(401, { erro: "código interno inválido" });
  let c: { itens?: Item[]; chave?: string } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  if (!c.chave) return resp(400, { erro: "informe a chave" });
  const chave = await crypto.subtle.importKey("raw", decodeBase64(c.chave), "AES-GCM", false, ["decrypt"]);
  const resultados = [];
  for (const it of (c.itens || []).slice(0, 12)) {
    try { resultados.push(await importar(it, chave)); } catch (e) { resultados.push({ membro_id: it.membro_id, tipo: it.tipo, ok: false, erro: e instanceof Error ? e.message : String(e) }); }
  }
  return resp(200, { resultados });
});
