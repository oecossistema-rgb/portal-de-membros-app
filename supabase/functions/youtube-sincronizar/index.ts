// Função "youtube-sincronizar": a aba Conteúdo mostra SÓ os vídeos que a equipe coloca nas playlists "Portal" do YouTube.
// Regra: playlist "Portal · Imersões" -> categoria "Imersões". Vídeo não listado -> selo "Exclusivo para membros".
// Saiu da playlist -> sai do portal (fica oculto, nada é apagado). O restante do canal não entra.
// As playlists ficam em Administração > Conteúdo (portal_config.youtube_playlists: um link por linha).
// Roda a cada hora e pelo botão "Sincronizar agora". Sem senha nem chave: usa as páginas públicas do YouTube.
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

const CHAVE_WEB = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CONTEXTO = { client: { clientName: "WEB", clientVersion: "2.20241101.01.00", hl: "pt", gl: "BR" } };
// deno-lint-ignore no-explicit-any
async function api(rota: string, corpo: Record<string, unknown>): Promise<any> {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/${rota}?key=${CHAVE_WEB}&prettyPrint=false`, {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", "Cookie": "SOCS=CAI; CONSENT=YES+1" },
    body: JSON.stringify({ context: CONTEXTO, ...corpo }),
  });
  return await r.json();
}

// Junta vídeos (id + título), o nome da playlist e o "carregar mais".
// deno-lint-ignore no-explicit-any
function percorrer(o: any, out: { videos: Map<string, string>; nome: string; conts: string[] }) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) percorrer(x, out); return; }
  const v = o.playlistVideoRenderer;
  if (v?.videoId && v.isPlayable !== false) { const t = v.title?.runs?.[0]?.text || v.title?.simpleText; if (t && !out.videos.has(v.videoId)) out.videos.set(v.videoId, t); }
  // Formato novo de lista (lockupViewModel).
  const lv = o.lockupViewModel;
  if (lv?.contentId && /VIDEO/.test(lv.contentType || "VIDEO") && /^[\w-]{11}$/.test(lv.contentId)) {
    const t = lv.metadata?.lockupMetadataViewModel?.title?.content;
    if (t && !out.videos.has(lv.contentId)) out.videos.set(lv.contentId, t);
  }
  if (!out.nome && o.playlistMetadataRenderer?.title) out.nome = o.playlistMetadataRenderer.title;
  const tok = o.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
  if (tok) out.conts.push(tok);
  for (const k in o) percorrer(o[k], out);
}

async function lerPlaylist(id: string) {
  const out = { videos: new Map<string, string>(), nome: "", conts: [] as string[] };
  percorrer(await api("browse", { browseId: `VL${id}` }), out);
  for (let i = 0; out.conts.length && i < 20; i++) { const prox = out.conts.pop()!; out.conts = []; percorrer(await api("browse", { continuation: prox }), out); }
  return out;
}

// Não listado? e data de publicação (página do vídeo).
async function detalhes(videoId: string): Promise<{ naoListado: boolean; publicado: string | null; descricao: string | null }> {
  try {
    const j = await api("player", { videoId });
    const m = j?.microformat?.playerMicroformatRenderer;
    return { naoListado: !!m?.isUnlisted, publicado: m?.publishDate || m?.uploadDate || null, descricao: m?.description?.simpleText?.slice(0, 2000) || null };
  } catch { return { naoListado: false, publicado: null, descricao: null }; }
}

const idDaPlaylist = (s: string) => /[?&]list=([\w-]+)/.exec(s)?.[1] || /^(PL[\w-]{10,}|UU[\w-]+|OL[\w-]+)$/.exec(s.trim())?.[1] || null;
const categoriaDoNome = (nome: string) => nome.replace(/^\s*portal\s*[·:|\-–—]*\s*/i, "").trim() || "Conteúdo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resp(405, { erro: "método não permitido" });
  if (!(await autorizado(req))) return resp(401, { erro: "somente administradores" });
  let pedido: { diag?: string } = {};
  try { pedido = await req.json(); } catch { /* vazio */ }
  if (pedido.diag) {
    const txt = JSON.stringify(await api("browse", { browseId: `VL${pedido.diag}` }));
    const conta = (k: string) => (txt.match(new RegExp(`"${k}"`, "g")) || []).length;
    return resp(200, { tam: txt.length, playlistVideoRenderer: conta("playlistVideoRenderer"), lockupViewModel: conta("lockupViewModel"), videoId: conta("videoId"),
      alerta: /"alertMessageRenderer"[\s\S]{0,300}/.exec(txt)?.[0]?.slice(0, 300) || null, ocultos: /unavailable|ocult|indispon/i.exec(txt)?.[0] || null });
  }
  const { data: cfg } = await db.from("portal_config").select("valor").eq("chave", "youtube_playlists").maybeSingle();
  const ids = [...new Set((cfg?.valor || "").split(/\s+/).map(idDaPlaylist).filter(Boolean) as string[])];
  if (!ids.length) return resp(200, { ok: false, aviso: "nenhuma playlist do portal configurada" });

  const noPortal = new Map<string, { titulo: string; categoria: string; playlist: string }>();
  const playlists: { id: string; nome: string; videos: number }[] = [];
  for (const id of ids) {
    const p = await lerPlaylist(id);
    playlists.push({ id, nome: p.nome, videos: p.videos.size });
    for (const [vid, titulo] of p.videos) if (!noPortal.has(vid)) noPortal.set(vid, { titulo, categoria: categoriaDoNome(p.nome), playlist: id });
  }
  // Se alguma playlist não pôde ser lida, não esconde nada (evita sumir tudo por falha do YouTube).
  const falhou = playlists.some((p) => !p.nome);

  const { data: atuais } = await db.from("conteudos").select("id, youtube_id, ativo, playlist_id").eq("origem", "youtube");
  const porVideo = new Map((atuais || []).map((c) => [c.youtube_id, c]));
  let novos = 0, voltaram = 0, sairam = 0;
  for (const [vid, info] of noPortal) {
    const ja = porVideo.get(vid);
    if (!ja) {
      const d = await detalhes(vid);
      const { error } = await db.from("conteudos").insert({
        tipo: "video", origem: "youtube", youtube_id: vid, titulo: info.titulo.slice(0, 300), descricao: d.descricao,
        url: `https://www.youtube.com/watch?v=${vid}`, capa_url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        publicado_em: d.publicado ? new Date(d.publicado).toISOString() : new Date().toISOString(),
        categoria: info.categoria, exclusivo: d.naoListado, playlist_id: info.playlist, ativo: true,
      });
      if (!error) novos++;
    } else if (!ja.ativo || ja.playlist_id !== info.playlist) {
      await db.from("conteudos").update({ ativo: true, playlist_id: info.playlist, categoria: info.categoria }).eq("id", ja.id);
      voltaram++;
    }
  }
  if (!falhou) {
    const fora = (atuais || []).filter((c) => c.ativo && !noPortal.has(c.youtube_id)).map((c) => c.id);
    if (fora.length) { await db.from("conteudos").update({ ativo: false }).in("id", fora); sairam = fora.length; }
  }
  await db.from("portal_config").update({ atualizado_em: new Date().toISOString() }).eq("chave", "youtube_playlists");
  return resp(200, { ok: true, playlists, novos, voltaram, sairam, no_portal: noPortal.size });
});
