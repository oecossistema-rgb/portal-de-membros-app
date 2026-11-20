// Função "youtube-sincronizar": traz para a aba Conteúdo os vídeos novos do canal do YouTube do Ecossistema.
// Usa o feed público do canal (não precisa de senha nem chave). O canal é configurado na Administração > Conteúdo
// (portal_config.youtube_canal: link do canal, @nome ou o código UC...). Roda a cada hora e também pelo botão "Sincronizar agora".
// Só ADICIONA vídeos novos; o que o administrador ocultou ou editou continua como está.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-interno" };
const resp = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

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

// Aceita: UCxxxx, @nome, youtube.com/@nome, youtube.com/channel/UCxxxx, youtube.com/c/nome
async function idDoCanal(entrada: string): Promise<string | null> {
  const t = entrada.trim();
  const direto = /(UC[\w-]{22})/.exec(t);
  if (direto) return direto[1];
  const nome = /@([\w.-]+)/.exec(t)?.[1];
  const url = nome ? `https://www.youtube.com/@${nome}` : /^https?:\/\//.test(t) ? t : `https://www.youtube.com/@${t}`;
  const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "pt-BR" } })).text();
  return /"(?:channelId|externalId)":"(UC[\w-]{22})"/.exec(html)?.[1] || /channel\/(UC[\w-]{22})/.exec(html)?.[1] || null;
}

// Categoria automática pelo título (a equipe pode trocar depois no painel).
export function categoriaDe(titulo: string, shorts = false): string | null {
  if (shorts) return "Shorts";
  if (/ecossistema\s+podcast|\bEP\.?\s*#?\s*\d+|#\d{2,}/i.test(titulo)) return "Ecossistema Podcast";
  return null;
}

// Catálogo completo do canal (o feed só traz os 15 últimos): pede a aba "Vídeos" direto à API interna do YouTube
// (a mesma que o site usa, sem login) e segue as páginas seguintes.
const CHAVE_WEB = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CONTEXTO = { client: { clientName: "WEB", clientVersion: "2.20241101.01.00", hl: "pt", gl: "BR" } };
async function browse(corpo: Record<string, unknown>): Promise<string> {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${CHAVE_WEB}&prettyPrint=false`, {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", "Cookie": "SOCS=CAI; CONSENT=YES+1" },
    body: JSON.stringify({ context: CONTEXTO, ...corpo }),
  });
  return await r.text();
}
// Percorre a resposta (JSON) e junta cada vídeo (id + título) e o "token" da próxima página.
function percorrer(o: unknown, vistos: Map<string, string>, conts: string[]) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) percorrer(x, vistos, conts); return; }
  const r = o as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const lv = r.lockupViewModel;
  if (lv?.contentId && lv.contentType !== "LOCKUP_CONTENT_TYPE_PLAYLIST") {
    const t = lv.metadata?.lockupMetadataViewModel?.title?.content;
    if (t && !vistos.has(lv.contentId)) vistos.set(lv.contentId, t);
  }
  const vr = r.videoRenderer || r.gridVideoRenderer;
  if (vr?.videoId) { const t = vr.title?.runs?.[0]?.text || vr.title?.simpleText; if (t && !vistos.has(vr.videoId)) vistos.set(vr.videoId, t); }
  // Só o "carregar mais" do fim da lista (os botões de ordenação também têm tokens, que não servem aqui).
  const tok = r.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
  if (tok) conts.push(tok);
  for (const k in r) percorrer(r[k], vistos, conts);
}

async function catalogoCompleto(canal: string): Promise<{ id: string; titulo: string }[]> {
  const vistos = new Map<string, string>();
  let conts: string[] = [];
  percorrer(JSON.parse(await browse({ browseId: canal, params: "EgZ2aWRlb3PyBgQKAjoA" })), vistos, conts);
  for (let i = 0; conts.length && i < 25; i++) {
    const prox = conts[conts.length - 1]; conts = [];
    percorrer(JSON.parse(await browse({ continuation: prox })), vistos, conts);
  }
  return [...vistos].map(([id, titulo]) => ({ id, titulo }));
}

const tag = (xml: string, t: string) => (new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`).exec(xml)?.[1] || "").trim();
const limpa = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  if (!(await autorizado(req))) return resp(401, { erro: "somente administradores" });
  const { data: cfg } = await db.from("portal_config").select("valor").eq("chave", "youtube_canal").maybeSingle();
  if (!cfg?.valor) return resp(200, { ok: false, aviso: "canal do YouTube ainda não configurado" });
  const canal = await idDoCanal(cfg.valor);
  if (!canal) return resp(200, { ok: false, erro: "não encontrei esse canal no YouTube" });
  let c: { completo?: boolean } = {};
  try { c = await req.json(); } catch { /* vazio */ }
  if (c.completo) {
    // Traz o catálogo inteiro (vídeos antigos). A data exata de publicação não vem nessa lista: usamos a ordem do canal
    // (mais novo primeiro), um dia a menos para cada, abaixo do vídeo mais antigo que já está no portal.
    const lista = await catalogoCompleto(canal);
    const { data: maisAntigo } = await db.from("conteudos").select("publicado_em").eq("origem", "youtube").order("publicado_em").limit(1).maybeSingle();
    const base = new Date(maisAntigo?.publicado_em || new Date().toISOString()).getTime();
    const { data: ja } = await db.from("conteudos").select("youtube_id").not("youtube_id", "is", null);
    const tem = new Set((ja || []).map((x) => x.youtube_id));
    const novos = lista.filter((v) => !tem.has(v.id)).map((v, i) => ({
      tipo: "video", origem: "youtube", youtube_id: v.id, titulo: v.titulo.slice(0, 300), url: `https://www.youtube.com/watch?v=${v.id}`,
      capa_url: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, publicado_em: new Date(base - (i + 1) * 86400000).toISOString(), categoria: categoriaDe(v.titulo),
    }));
    if (novos.length) {
      const { error } = await db.from("conteudos").upsert(novos, { onConflict: "youtube_id", ignoreDuplicates: true });
      if (error) return resp(500, { erro: error.message });
    }
    return resp(200, { ok: true, canal, no_canal: lista.length, novos: novos.length });
  }
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal}`)).text();
  const entradas = xml.split("<entry>").slice(1);
  const linhas = entradas.map((e) => {
    const id = tag(e, "yt:videoId");
    return {
      tipo: "video", origem: "youtube", youtube_id: id,
      titulo: limpa(tag(e, "title")).slice(0, 300),
      descricao: limpa(tag(e, "media:description")).slice(0, 2000) || null,
      url: `https://www.youtube.com/watch?v=${id}`,
      capa_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publicado_em: tag(e, "published") || new Date().toISOString(),
      categoria: categoriaDe(limpa(tag(e, "title")), /\/shorts\//.test(e)),
    };
  }).filter((l) => l.youtube_id);
  if (!linhas.length) return resp(200, { ok: true, canal, novos: 0 });
  const { data, error } = await db.from("conteudos").upsert(linhas, { onConflict: "youtube_id", ignoreDuplicates: true }).select("id");
  if (error) return resp(500, { erro: error.message });
  await db.from("portal_config").update({ atualizado_em: new Date().toISOString() }).eq("chave", "youtube_canal");
  return resp(200, { ok: true, canal, no_feed: linhas.length, novos: data?.length || 0 });
});
