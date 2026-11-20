// Aba "Conteúdo": vídeos do canal do YouTube do Ecossistema e fotos, numa grade visual.
// ConteudoMembro = o que o membro vê. AdminConteudo = gestão (canal do YouTube, itens manuais, destaque, ocultar).
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

export type Conteudo = {
  id: string; tipo: "video" | "foto"; titulo: string; descricao: string | null; categoria: string | null;
  url: string; capa_url: string | null; youtube_id: string | null; publicado_em: string; destaque: boolean; ativo: boolean; origem: string; exclusivo?: boolean;
};

const ytId = (url: string) => /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url)?.[1] || null;
const capaDe = (c: Conteudo) => c.capa_url || (c.youtube_id || ytId(c.url) ? `https://i.ytimg.com/vi/${c.youtube_id || ytId(c.url)}/hqdefault.jpg` : c.url);
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");

const CSS = `
.ct{ text-align:left; display:flex; flex-direction:column; gap:26px; min-width:0 }
.ct-topo{ display:flex; gap:12px; align-items:center; flex-wrap:wrap }
.ct-busca{ flex:1 1 260px; display:flex; align-items:center; gap:10px; background:var(--p-card); border:1px solid var(--p-line2); border-radius:14px; padding:0 14px; height:46px }
.ct-busca input{ flex:1; border:0; outline:0; background:transparent; font:inherit; font-size:15px; color:var(--p-text) }
.ct-hero{ position:relative; border-radius:24px; overflow:hidden; aspect-ratio:21/8; background:#0b1f12; box-shadow:var(--p-shadow) }
.ct-hero img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover }
.ct-hero::after{ content:""; position:absolute; inset:0; background:linear-gradient(90deg,rgba(5,10,7,.92) 0%,rgba(5,10,7,.6) 42%,rgba(5,10,7,0) 75%) }
.ct-hero-txt{ position:absolute; z-index:1; left:36px; bottom:32px; right:42%; color:#fff }
.ct-hero-txt small{ font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#9FE3B5 }
.ct-hero-txt h2{ color:#fff; margin:10px 0 18px; font-size:30px; line-height:1.15; font-weight:750; letter-spacing:-.02em; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden }
.ct-hero-bts{ display:flex; gap:10px; flex-wrap:wrap }
.ct-bt{ display:inline-flex; align-items:center; gap:9px; border:0; border-radius:980px; padding:12px 22px; font:inherit; font-size:15px; font-weight:700; cursor:pointer }
.ct-bt.prim{ background:#fff; color:#0b1f12 }
.ct-bt.sec{ background:rgba(255,255,255,.18); color:#fff; backdrop-filter:blur(8px) }
.ct-fila h3{ margin:0 0 12px; font-size:19px; font-weight:700; letter-spacing:-.02em; color:var(--p-text); display:flex; align-items:baseline; gap:10px }
.ct-fila h3 span{ font-size:13px; font-weight:500; color:var(--p-muted) }
.ct-trilho-wrap{ position:relative }
.ct-trilho{ display:grid; grid-auto-flow:column; grid-auto-columns:calc((100% - 48px) / 4); gap:16px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; padding:2px 2px 6px }
.ct-trilho::-webkit-scrollbar{ display:none }
.ct-seta{ position:absolute; top:calc(50% - 40px); width:40px; height:40px; border-radius:50%; border:1px solid var(--p-line2); background:var(--p-card); color:var(--p-text); box-shadow:var(--p-shadow); cursor:pointer; font-size:20px; z-index:2; display:flex; align-items:center; justify-content:center }
.ct-seta.esq{ left:-14px } .ct-seta.dir{ right:-14px }
.ct-card{ scroll-snap-align:start; border:0; padding:0; background:none; text-align:left; cursor:pointer; color:var(--p-text); font:inherit; min-width:0 }
.ct-capa{ position:relative; aspect-ratio:16/9; border-radius:14px; overflow:hidden; background:var(--p-hover) }
.ct-capa img{ width:100%; height:100%; object-fit:cover; display:block; transition:transform .4s ease }
.ct-card:hover .ct-capa img{ transform:scale(1.05) }
.ct-mini{ position:absolute; left:10px; bottom:12px; width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,.55); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center }
.ct-selo{ position:absolute; top:10px; left:10px; background:var(--p-accent); color:var(--p-on-accent); font-size:10.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; border-radius:980px; padding:3px 9px }
.ct-visto{ position:absolute; top:10px; right:10px; background:rgba(0,0,0,.6); color:#fff; font-size:11px; font-weight:700; border-radius:980px; padding:3px 9px }
.ct-prog{ position:absolute; left:0; right:0; bottom:0; height:4px; background:rgba(255,255,255,.25) }
.ct-prog i{ display:block; height:100%; background:var(--p-accent) }
.ct-card h4{ margin:9px 2px 2px; font-size:14.5px; font-weight:650; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden }
.ct-card small{ margin:0 2px; font-size:12px; color:var(--p-muted) }
.ct-grade{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px }
.ct-vazio{ background:var(--p-card); border:1px dashed var(--p-line2); border-radius:22px; padding:48px 24px; text-align:center; color:var(--p-muted) }
.ct-modal{ position:fixed; inset:0; z-index:10003; background:rgba(0,0,0,.92); display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto }
.ct-player{ width:min(1100px,96vw) }
.ct-player-tela{ aspect-ratio:16/9; background:#000; border-radius:14px; overflow:hidden }
.ct-player-tela > div, .ct-player-tela iframe, .ct-player-tela video{ width:100%; height:100%; border:0; display:block }
.ct-player-info{ display:flex; gap:14px; align-items:flex-start; justify-content:space-between; color:#fff; margin-top:14px }
.ct-player-info h3{ margin:0; font-size:18px; font-weight:700; line-height:1.3; color:#fff }
.ct-player-info small{ color:rgba(255,255,255,.65); font-size:13px }
.ct-modal-x{ position:fixed; top:16px; right:16px; border:0; width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.14); color:#fff; font-size:24px; cursor:pointer; z-index:2 }
.ct-cheia{ position:fixed; inset:0; z-index:10003; background:#000; display:flex; align-items:center; justify-content:center }
.ct-cheia-video{ width:100%; height:100%; border:0; display:block; background:#000 }
.ct-cheia-video > div, .ct-cheia-video iframe{ width:100%; height:100%; border:0; display:block }
.ct-cheia-topo{ position:absolute; top:0; left:0; right:0; display:flex; align-items:center; gap:10px; padding:12px 14px; background:linear-gradient(180deg,rgba(0,0,0,.7),rgba(0,0,0,0)); pointer-events:none }
.ct-cheia-topo > *{ pointer-events:auto }
.ct-cheia-tit{ flex:1; min-width:0; color:#fff; font-size:14.5px; font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.ct-cheia-bt{ border:0; border-radius:980px; background:rgba(255,255,255,.18); color:#fff; padding:8px 14px; font:inherit; font-size:13px; font-weight:700; cursor:pointer; backdrop-filter:blur(8px); white-space:nowrap }
.ct-cheia-x{ border:0; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,.18); color:#fff; font-size:22px; cursor:pointer; flex-shrink:0 }
.ct-modal img.ct-foto{ max-width:96vw; max-height:88vh; object-fit:contain; border-radius:8px }
@media (max-width:1100px){ .ct-trilho{ grid-auto-columns:calc((100% - 32px) / 3) } .ct-grade{ grid-template-columns:repeat(3,1fr) } }
@media (max-width:640px){
  .ct{ gap:22px }
  .ct-trilho{ grid-auto-columns:72%; gap:12px } .ct-seta{ display:none } .ct-grade{ grid-template-columns:1fr 1fr; gap:12px }
  .ct-hero{ aspect-ratio:4/5 } .ct-hero::after{ background:linear-gradient(0deg,rgba(5,10,7,.95) 0%,rgba(5,10,7,.55) 45%,rgba(5,10,7,.1) 75%) }
  .ct-hero-txt{ left:20px; right:20px; bottom:22px } .ct-hero-txt h2{ font-size:23px }
  .ct-player-info{ flex-direction:column }
}
`;

const Play = ({ t = 16, cor = "#fff" }: { t?: number; cor?: string }) => <svg width={t} height={t} viewBox="0 0 24 24" fill={cor} aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
type Progresso = { conteudo_id: string; segundos: number; duracao: number | null; concluido: boolean; atualizado_em: string };

// Carrega a API de vídeo do YouTube uma vez (para lembrar onde o membro parou).
type YTPlayer = { getCurrentTime: () => number; getDuration: () => number; destroy: () => void };
let ytPronto: Promise<void> | null = null;
function carregarYT(): Promise<void> {
  const w = window as unknown as { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve();
  if (!ytPronto) ytPronto = new Promise((ok) => {
    w.onYouTubeIframeAPIReady = () => ok();
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  });
  return ytPronto;
}

function Cartao({ c, p, onAbrir }: { c: Conteudo; p?: Progresso; onAbrir: () => void }) {
  const pct = p?.duracao ? Math.min(100, Math.round((p.segundos / p.duracao) * 100)) : 0;
  return (
    <button className="ct-card" onClick={onAbrir} title={c.titulo}>
      <div className="ct-capa">
        <img src={capaDe(c)} alt="" loading="lazy" />
        {c.exclusivo && <span className="ct-selo">Exclusivo</span>}
        {p?.concluido && <span className="ct-visto">✓ Assistido</span>}
        {c.tipo === "video" && <span className="ct-mini"><Play t={13} /></span>}
        {!p?.concluido && pct > 0 && <span className="ct-prog"><i style={{ width: `${pct}%` }} /></span>}
      </div>
      <h4>{c.titulo}</h4>
      <small>{dataBR(c.publicado_em)}{c.categoria ? ` · ${c.categoria}` : ""}</small>
    </button>
  );
}

function Fila({ titulo, itens, prog, onAbrir, extra }: { titulo: string; itens: Conteudo[]; prog: Record<string, Progresso>; onAbrir: (c: Conteudo) => void; extra?: string }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  if (!itens.length) return null;
  const rolar = (d: number) => el?.scrollBy({ left: d * el.clientWidth * 0.9, behavior: "smooth" });
  return (
    <section className="ct-fila">
      <h3>{titulo}{extra && <span>{extra}</span>}</h3>
      <div className="ct-trilho-wrap">
        {itens.length > 4 && <button className="ct-seta esq" onClick={() => rolar(-1)} aria-label="Anteriores">‹</button>}
        <div className="ct-trilho" ref={setEl}>
          {itens.map((c) => <Cartao key={c.id} c={c} p={prog[c.id]} onAbrir={() => onAbrir(c)} />)}
        </div>
        {itens.length > 4 && <button className="ct-seta dir" onClick={() => rolar(1)} aria-label="Próximos">›</button>}
      </div>
    </section>
  );
}

function Player({ c, prog, naLista, onLista, onSalvar, onFechar }: {
  c: Conteudo; prog?: Progresso; naLista: boolean; onLista: () => void; onSalvar: (seg: number, dur: number, fim: boolean) => void; onFechar: () => void;
}) {
  const yid = c.tipo === "video" ? c.youtube_id || ytId(c.url) : null;
  const alvo = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  // Igual ao vídeo do evento realizado: abre em tela cheia e, no celular, acompanha o giro para a horizontal.
  useEffect(() => {
    if (c.tipo !== "video") return;
    const el = tela.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try { if (el?.requestFullscreen) el.requestFullscreen().catch(() => {}); else el?.webkitRequestFullscreen?.(); } catch { /* sem suporte */ }
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    try { o?.lock?.("landscape").catch(() => {}); } catch { /* sem suporte */ }
    let entrou = false;
    const mudou = () => { if (document.fullscreenElement) entrou = true; else if (entrou) onFechar(); };
    document.addEventListener("fullscreenchange", mudou);
    return () => {
      document.removeEventListener("fullscreenchange", mudou);
      try { o?.unlock?.(); } catch { /* */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inicio = prog && !prog.concluido ? Math.max(0, Math.floor(prog.segundos) - 3) : 0;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  useEffect(() => {
    if (!yid || !alvo.current) return;
    let player: YTPlayer | null = null; let t = 0; let vivo = true;
    carregarYT().then(() => {
      if (!vivo || !alvo.current) return;
      const YT = (window as unknown as { YT: { Player: new (el: HTMLElement, o: unknown) => YTPlayer; PlayerState: { ENDED: number } } }).YT;
      player = new YT.Player(alvo.current, {
        videoId: yid, playerVars: { autoplay: 1, rel: 0, playsinline: 1, start: inicio, modestbranding: 1 },
        events: { onStateChange: (ev: { data: number }) => { if (ev.data === YT.PlayerState.ENDED && player) onSalvar(player.getDuration(), player.getDuration(), true); } },
      });
      t = window.setInterval(() => {
        try { const s = player!.getCurrentTime(), d = player!.getDuration(); if (d > 0 && s > 5) onSalvar(s, d, s / d > 0.95); } catch { /* ainda carregando */ }
      }, 10000);
    });
    return () => {
      vivo = false; window.clearInterval(t);
      try { if (player) { const s = player.getCurrentTime(), d = player.getDuration(); if (d > 0 && s > 5) onSalvar(s, d, s / d > 0.95); player.destroy(); } } catch { /* */ }
    };
  }, [yid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (c.tipo === "foto") return (
    <div className="ct-modal" onClick={onFechar} role="dialog" aria-label={c.titulo}>
      <button className="ct-modal-x" onClick={onFechar} aria-label="Fechar">×</button>
      <img className="ct-foto" src={c.url} alt={c.titulo} onClick={(e) => e.stopPropagation()} />
    </div>
  );
  return (
    <div className="ct-cheia" ref={tela} role="dialog" aria-label={c.titulo}>
      {yid ? <div className="ct-cheia-video"><div ref={alvo} /></div> : <video className="ct-cheia-video" src={c.url} controls autoPlay playsInline
        onLoadedMetadata={(e) => { if (inicio) e.currentTarget.currentTime = inicio; }}
        onPause={(e) => onSalvar(e.currentTarget.currentTime, e.currentTarget.duration, e.currentTarget.ended)}
        onEnded={(e) => onSalvar(e.currentTarget.duration, e.currentTarget.duration, true)} />}
      <div className="ct-cheia-topo">
        <div className="ct-cheia-tit">{c.titulo}</div>
        <button className="ct-cheia-bt" onClick={onLista}>{naLista ? "✓ Na lista" : "+ Minha lista"}</button>
        <button className="ct-cheia-x" onClick={onFechar} aria-label="Fechar">×</button>
      </div>
    </div>
  );
}

export function ConteudoMembro() {
  const [itens, setItens] = useState<Conteudo[]>([]);
  const [prog, setProg] = useState<Record<string, Progresso>>({});
  const [lista, setLista] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Conteudo | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("conteudos").select("*").eq("ativo", true).order("publicado_em", { ascending: false }),
      supabase.from("conteudo_progresso").select("conteudo_id,segundos,duracao,concluido,atualizado_em"),
      supabase.from("conteudo_favoritos").select("conteudo_id"),
    ]).then(([c, p, f]) => {
      setItens((c.data as Conteudo[]) || []);
      const m: Record<string, Progresso> = {}; ((p.data as Progresso[]) || []).forEach((x) => { m[x.conteudo_id] = x; }); setProg(m);
      setLista(new Set(((f.data as { conteudo_id: string }[]) || []).map((x) => x.conteudo_id)));
      setCarregando(false);
    });
  }, []);

  const salvar = (c: Conteudo) => (seg: number, dur: number, fim: boolean) => {
    const linha = { conteudo_id: c.id, segundos: Math.floor(seg), duracao: Math.floor(dur) || null, concluido: fim, atualizado_em: new Date().toISOString() };
    setProg((p) => ({ ...p, [c.id]: { ...linha, concluido: fim || !!p[c.id]?.concluido } }));
    supabase.from("conteudo_progresso").upsert({ ...linha, concluido: fim || !!prog[c.id]?.concluido }).then(() => {});
  };
  const alternarLista = async (c: Conteudo) => {
    const tem = lista.has(c.id);
    const n = new Set(lista); if (tem) n.delete(c.id); else n.add(c.id); setLista(n);
    if (tem) await supabase.from("conteudo_favoritos").delete().eq("conteudo_id", c.id);
    else await supabase.from("conteudo_favoritos").insert({ conteudo_id: c.id });
  };

  const videos = itens.filter((i) => i.tipo === "video");
  const fotos = itens.filter((i) => i.tipo === "foto");
  const termo = busca.trim().toLowerCase();
  const achados = termo ? itens.filter((i) => `${i.titulo} ${i.categoria || ""} ${i.descricao || ""}`.toLowerCase().includes(termo)) : [];
  const continuar = videos.filter((v) => prog[v.id] && !prog[v.id].concluido && prog[v.id].segundos > 10)
    .sort((a, b) => prog[b.id].atualizado_em.localeCompare(prog[a.id].atualizado_em));
  const exclusivos = videos.filter((v) => v.exclusivo);
  const minhaLista = itens.filter((i) => lista.has(i.id));
  const categorias = useMemo(() => {
    const m = new Map<string, Conteudo[]>();
    videos.forEach((v) => { const k = v.categoria || "Mais vídeos"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(v); });
    return [...m].sort((a, b) => (a[0] === "Mais vídeos" ? 1 : b[0] === "Mais vídeos" ? -1 : b[1].length - a[1].length));
  }, [itens]); // eslint-disable-line react-hooks/exhaustive-deps
  const destaque = videos.find((v) => v.destaque) || exclusivos[0] || videos[0];
  const pDest = destaque ? prog[destaque.id] : undefined;

  return (
    <div className="ct">
      <style>{CSS}</style>
      <section style={ui.hero}>
        <div style={ui.heroInner}>
          <div style={ui.heroEyebrow}>Conteúdo</div>
          <h1 style={ui.heroTitle}>Aprenda, reveja e se inspire.</h1>
          <p style={ui.heroSub}>Episódios do Ecossistema Podcast, conteúdos exclusivos para membros e os melhores momentos da comunidade.</p>
        </div>
      </section>
      {carregando ? <div className="ct-vazio">Carregando...</div> : !itens.length ? (
        <div className="ct-vazio">
          <div style={{ fontSize: 34, marginBottom: 8 }}>🎬</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--p-text)" }}>Conteúdos chegando em breve</div>
        </div>
      ) : (
        <>
          <div className="ct-topo">
            <label className="ct-busca">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--p-muted)" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input placeholder="Buscar por tema, convidado ou episódio" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
          </div>
          {termo ? (
            achados.length ? (
              <section className="ct-fila">
                <h3>Resultados<span>{achados.length}</span></h3>
                <div className="ct-grade">{achados.map((c) => <Cartao key={c.id} c={c} p={prog[c.id]} onAbrir={() => setAberto(c)} />)}</div>
              </section>
            ) : <div className="ct-vazio">Nada encontrado para "{busca}".</div>
          ) : (
            <>
              {destaque && (
                <section className="ct-hero">
                  <img src={capaDe(destaque).replace("hqdefault", "maxresdefault")} onError={(e) => { (e.target as HTMLImageElement).src = capaDe(destaque); }} alt="" />
                  <div className="ct-hero-txt">
                    <small>{destaque.exclusivo ? "Exclusivo para membros" : destaque.destaque ? "Em destaque" : "Mais recente"}{destaque.categoria ? ` · ${destaque.categoria}` : ""}</small>
                    <h2>{destaque.titulo}</h2>
                    <div className="ct-hero-bts">
                      <button className="ct-bt prim" onClick={() => setAberto(destaque)}><Play cor="#0b1f12" />{pDest && !pDest.concluido && pDest.segundos > 10 ? "Continuar" : "Assistir"}</button>
                      <button className="ct-bt sec" onClick={() => alternarLista(destaque)}>{lista.has(destaque.id) ? "✓ Na minha lista" : "+ Minha lista"}</button>
                    </div>
                  </div>
                </section>
              )}
              <Fila titulo="Continuar assistindo" itens={continuar} prog={prog} onAbrir={setAberto} />
              <Fila titulo="Exclusivo para membros" itens={exclusivos} prog={prog} onAbrir={setAberto} />
              <Fila titulo="Novos" itens={videos.slice(0, 12)} prog={prog} onAbrir={setAberto} />
              <Fila titulo="Minha lista" itens={minhaLista} prog={prog} onAbrir={setAberto} />
              {categorias.map(([cat, vs]) => <Fila key={cat} titulo={cat} itens={vs} prog={prog} onAbrir={setAberto} extra={`${vs.length} ${vs.length === 1 ? "vídeo" : "vídeos"}`} />)}
              <Fila titulo="Fotos" itens={fotos} prog={prog} onAbrir={setAberto} />
            </>
          )}
        </>
      )}
      {aberto && <Player c={aberto} prog={prog[aberto.id]} naLista={lista.has(aberto.id)} onLista={() => alternarLista(aberto)} onSalvar={salvar(aberto)} onFechar={() => setAberto(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ADMINISTRAÇÃO > CONTEÚDO                                            */
/* ------------------------------------------------------------------ */

const VAZIO = { tipo: "video" as "video" | "foto", titulo: "", url: "", categoria: "", destaque: false, exclusivo: true };

export function AdminConteudo() {
  const [itens, setItens] = useState<Conteudo[]>([]);
  const [canal, setCanal] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [novo, setNovo] = useState(VAZIO);
  const [ocupado, setOcupado] = useState("");

  async function carregar() {
    const [{ data: c }, { data: cfg }] = await Promise.all([
      supabase.from("conteudos").select("*").order("publicado_em", { ascending: false }),
      supabase.from("portal_config").select("valor").eq("chave", "youtube_canal").maybeSingle(),
    ]);
    setItens((c as Conteudo[]) || []);
    if (cfg?.valor) setCanal(cfg.valor);
  }
  useEffect(() => { carregar(); }, []);

  async function sincronizar(completo = false) {
    setOcupado(completo ? "completo" : "sync"); setMsg(null);
    const { data, error } = await supabase.functions.invoke("youtube-sincronizar", { body: completo ? { completo: true } : {} });
    setOcupado("");
    if (error || data?.erro) { setMsg({ tipo: "erro", texto: data?.erro ? `Não foi possível: ${data.erro}.` : "Não foi possível sincronizar agora." }); return; }
    if (data?.aviso) { setMsg({ tipo: "erro", texto: "Informe o canal do YouTube primeiro." }); return; }
    setMsg({ tipo: "ok", texto: data.novos ? `${data.novos} vídeo(s) trazido(s) do canal.` : "Canal conferido: nenhum vídeo novo." });
    carregar();
  }

  async function salvarCanal() {
    setOcupado("canal");
    const { error } = await supabase.from("portal_config").upsert({ chave: "youtube_canal", valor: canal.trim(), atualizado_em: new Date().toISOString() });
    setOcupado("");
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível salvar o canal." }); return; }
    await sincronizar();
  }

  async function enviarFoto(arq: File) {
    setOcupado("foto");
    const caminho = `conteudo/${Date.now()}-${arq.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("portal-midia").upload(caminho, arq, { contentType: arq.type, cacheControl: "31536000" });
    setOcupado("");
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível enviar a imagem (até 50 MB, JPG/PNG/WebP)." }); return; }
    setNovo({ ...novo, tipo: "foto", url: supabase.storage.from("portal-midia").getPublicUrl(caminho).data.publicUrl });
  }

  async function adicionar() {
    if (!novo.titulo.trim() || !novo.url.trim()) { setMsg({ tipo: "erro", texto: "Preencha o título e o link (ou envie a foto)." }); return; }
    const yid = novo.tipo === "video" ? ytId(novo.url) : null;
    const { error } = await supabase.from("conteudos").insert({
      tipo: novo.tipo, titulo: novo.titulo.trim(), url: novo.url.trim(), categoria: novo.categoria.trim() || null, destaque: novo.destaque, exclusivo: novo.exclusivo,
      youtube_id: yid, capa_url: yid ? `https://i.ytimg.com/vi/${yid}/hqdefault.jpg` : null,
    });
    if (error) { setMsg({ tipo: "erro", texto: error.code === "23505" ? "Esse vídeo já está no Conteúdo." : "Não foi possível adicionar." }); return; }
    setNovo(VAZIO); setMsg({ tipo: "ok", texto: "Adicionado ao Conteúdo." }); carregar();
  }

  async function alterar(c: Conteudo, campos: Partial<Conteudo>) {
    if (campos.destaque) await supabase.from("conteudos").update({ destaque: false }).neq("id", c.id).eq("destaque", true);
    await supabase.from("conteudos").update(campos).eq("id", c.id); carregar();
  }
  async function excluir(c: Conteudo) {
    if (!confirm(`Excluir "${c.titulo}" do Conteúdo?${c.origem === "youtube" ? " (No YouTube ele continua; aqui some. Para só esconder, use Ocultar.)" : ""}`)) return;
    await supabase.from("conteudos").delete().eq("id", c.id); carregar();
  }

  return (
    <main style={ui.largo}>
      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
      <div style={{ ...ui.cartao, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Canal do YouTube</div>
        <div style={{ fontSize: 13.5, color: "var(--p-muted)" }}>Cole o link do canal (ex.: youtube.com/@ecossistema). Os vídeos novos entram sozinhos no Conteúdo a cada hora.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...ui.input, flex: "1 1 280px" }} placeholder="https://www.youtube.com/@..." value={canal} onChange={(e) => setCanal(e.target.value)} />
          <button className="cta-btn" style={ui.botao} onClick={salvarCanal} disabled={!canal.trim() || !!ocupado}>{ocupado === "canal" ? "Salvando..." : "Salvar canal"}</button>
          <button style={ui.botaoSecundario} onClick={() => sincronizar()} disabled={!!ocupado}>{ocupado === "sync" ? "Sincronizando..." : "Sincronizar agora"}</button>
          <button style={ui.botaoSecundario} onClick={() => sincronizar(true)} disabled={!!ocupado} title="Traz também os vídeos antigos do canal">{ocupado === "completo" ? "Trazendo..." : "Trazer catálogo completo"}</button>
        </div>
      </div>
      <div style={{ ...ui.cartao, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Adicionar conteúdo exclusivo ou manual</div>
        <div style={{ fontSize: 13.5, color: "var(--p-muted)" }}>Para exclusivos: suba o vídeo no YouTube como <strong>não listado</strong> e cole o link aqui.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select style={{ ...ui.input, flex: "0 0 140px" }} value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as "video" | "foto", url: "" })}>
            <option value="video">Vídeo</option><option value="foto">Foto</option>
          </select>
          <input style={{ ...ui.input, flex: "1 1 240px" }} placeholder="Título" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
          <input style={{ ...ui.input, flex: "0 1 200px" }} placeholder="Categoria (opcional)" value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...ui.input, flex: "1 1 320px" }} placeholder={novo.tipo === "video" ? "Link do vídeo no YouTube" : "Link da imagem ou envie o arquivo"} value={novo.url} onChange={(e) => setNovo({ ...novo, url: e.target.value })} />
          {novo.tipo === "foto" && (
            <label style={{ ...ui.botaoSecundario, display: "inline-flex", alignItems: "center" }}>
              {ocupado === "foto" ? "Enviando..." : "Enviar foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(f); e.target.value = ""; }} />
            </label>
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={novo.destaque} onChange={(e) => setNovo({ ...novo, destaque: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--p-accent)" }} />Destaque
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={novo.exclusivo} onChange={(e) => setNovo({ ...novo, exclusivo: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--p-accent)" }} />Exclusivo para membros
          </label>
          <button className="cta-btn" style={ui.botao} onClick={adicionar}>Adicionar</button>
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--p-accent)", margin: "14px 0 10px" }}>{itens.length} item(ns) no Conteúdo</div>
      {itens.map((c) => (
        <div key={c.id} style={{ ...ui.cartao, padding: "10px 14px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", opacity: c.ativo ? 1 : 0.5 }}>
          <img src={capaDe(c)} alt="" style={{ width: 112, height: 63, objectFit: "cover", borderRadius: 10, background: "var(--p-hover)" }} />
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={{ fontWeight: 650 }}>{c.titulo}</div>
            <div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>
              {c.tipo === "video" ? "Vídeo" : "Foto"} · {dataBR(c.publicado_em)}{c.categoria ? ` · ${c.categoria}` : ""}{c.origem === "youtube" ? " · do canal" : ""}{c.destaque ? " · ★ Destaque" : ""}{c.exclusivo ? " · Exclusivo" : ""}{!c.ativo ? " · Oculto" : ""}
            </div>
          </div>
          <input style={{ ...ui.input, width: 150, padding: "7px 10px", fontSize: 13 }} placeholder="Categoria" defaultValue={c.categoria || ""}
            onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== c.categoria) alterar(c, { categoria: v }); }} />
          <button style={ui.botaoSecundario} onClick={() => alterar(c, { exclusivo: !c.exclusivo })}>{c.exclusivo ? "Tirar exclusivo" : "Exclusivo"}</button>
          <button style={ui.botaoSecundario} onClick={() => alterar(c, { destaque: !c.destaque })}>{c.destaque ? "Tirar destaque" : "Destacar"}</button>
          <button style={ui.botaoSecundario} onClick={() => alterar(c, { ativo: !c.ativo })}>{c.ativo ? "Ocultar" : "Mostrar"}</button>
          <button style={ui.botaoPerigo} onClick={() => excluir(c)}>Excluir</button>
        </div>
      ))}
    </main>
  );
}
