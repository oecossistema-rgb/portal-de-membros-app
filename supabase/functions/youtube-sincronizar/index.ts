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
      categoria: /\/shorts\//.test(e) ? "Shorts" : null,
    };
  }).filter((l) => l.youtube_id);
  if (!linhas.length) return resp(200, { ok: true, canal, novos: 0 });
  const { data, error } = await db.from("conteudos").upsert(linhas, { onConflict: "youtube_id", ignoreDuplicates: true }).select("id");
  if (error) return resp(500, { erro: error.message });
  await db.from("portal_config").update({ atualizado_em: new Date().toISOString() }).eq("chave", "youtube_canal");
  return resp(200, { ok: true, canal, no_feed: linhas.length, novos: data?.length || 0 });
});
