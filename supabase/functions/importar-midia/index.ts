// Função "importar-midia": guarda no armazenamento do portal (bucket portal-midia) vídeos/imagens que chegam
// CRIPTOGRAFADOS (AES-GCM: 12 bytes de nonce + conteúdo) num link temporário. Só quem tem a chave (enviada
// nesta chamada, nunca guardada) consegue abrir. Só chamada interna (cabeçalho x-portal-interno).
// Entrada: { chave, itens: [{ url, caminho, tipo }] }  ->  [{ caminho, publico }]
import { createClient } from "jsr:@supabase/supabase-js@2";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";

const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  const interno = req.headers.get("x-portal-interno");
  if (!interno) return resp(401, { erro: "somente chamada interna" });
  const { data: valido } = await db.rpc("token_interno_valido", { p_token: interno });
  if (valido !== true) return resp(401, { erro: "código interno inválido" });
  let c: { chave?: string; itens?: { url: string; caminho: string; tipo: string }[] } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  if (!c.chave) return resp(400, { erro: "informe a chave" });
  const chave = await crypto.subtle.importKey("raw", decodeBase64(c.chave), "AES-GCM", false, ["decrypt"]);
  const resultados = [];
  for (const it of (c.itens || []).slice(0, 4)) {
    try {
      const r = await fetch(it.url);
      if (!r.ok) { resultados.push({ caminho: it.caminho, ok: false, erro: `download ${r.status}` }); continue; }
      const cifrado = new Uint8Array(await r.arrayBuffer());
      const bytes = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: cifrado.slice(0, 12) }, chave, cifrado.slice(12)));
      const { error } = await db.storage.from("portal-midia").upload(it.caminho, bytes, { contentType: it.tipo, upsert: true, cacheControl: "31536000" });
      if (error) { resultados.push({ caminho: it.caminho, ok: false, erro: error.message }); continue; }
      resultados.push({ caminho: it.caminho, ok: true, bytes: bytes.length, publico: `${URL_BASE}/storage/v1/object/public/portal-midia/${it.caminho}` });
    } catch (e) {
      resultados.push({ caminho: it.caminho, ok: false, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return resp(200, { resultados });
});
