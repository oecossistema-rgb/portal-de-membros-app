// Aba "Conteúdo": vídeos do canal do YouTube do Ecossistema e fotos, numa grade visual.
// ConteudoMembro = o que o membro vê. AdminConteudo = gestão (canal do YouTube, itens manuais, destaque, ocultar).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

export type Conteudo = {
  id: string; tipo: "video" | "foto"; titulo: string; descricao: string | null; categoria: string | null;
  url: string; capa_url: string | null; youtube_id: string | null; publicado_em: string; destaque: boolean; ativo: boolean; origem: string;
};

const ytId = (url: string) => /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url)?.[1] || null;
const capaDe = (c: Conteudo) => c.capa_url || (c.youtube_id || ytId(c.url) ? `https://i.ytimg.com/vi/${c.youtube_id || ytId(c.url)}/hqdefault.jpg` : c.url);
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");

const CSS = `
.ct{ text-align:left; display:flex; flex-direction:column; gap:22px }
.ct-filtros{ display:flex; gap:6px; overflow-x:auto; scrollbar-width:none }
.ct-filtros::-webkit-scrollbar{ display:none }
.ct-filtro{ border:1px solid var(--p-line2); background:var(--p-card); color:var(--p-text); border-radius:980px; padding:8px 16px; font:inherit; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap }
.ct-filtro.on{ background:var(--p-accent); border-color:var(--p-accent); color:var(--p-on-accent) }
.ct-destaque{ position:relative; display:block; width:100%; border:0; padding:0; border-radius:22px; overflow:hidden; cursor:pointer; aspect-ratio:21/9; background:#000; text-align:left; box-shadow:var(--p-shadow) }
.ct-destaque img{ width:100%; height:100%; object-fit:cover; display:block; transition:transform 6s ease }
.ct-destaque:hover img{ transform:scale(1.04) }
.ct-destaque::after{ content:""; position:absolute; inset:0; background:linear-gradient(90deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.35) 50%,rgba(0,0,0,0) 80%) }
.ct-destaque-txt{ position:absolute; z-index:1; left:32px; bottom:28px; right:40%; color:#fff }
.ct-destaque-txt small{ font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#9FE3B5 }
.ct-destaque-txt h2{ color:#fff; margin:8px 0 10px; font-size:30px; line-height:1.12; font-weight:750; letter-spacing:-.02em }
.ct-destaque-txt span{ display:inline-flex; align-items:center; gap:10px; font-weight:650; font-size:15px }
.ct-play{ width:44px; height:44px; border-radius:50%; background:var(--p-accent); display:inline-flex; align-items:center; justify-content:center; box-shadow:0 8px 20px -6px var(--p-accent) }
.ct-secao{ display:flex; align-items:baseline; justify-content:space-between; margin:6px 0 -6px }
.ct-secao h3{ margin:0; font-size:20px; font-weight:700; letter-spacing:-.02em; color:var(--p-text) }
.ct-secao span{ font-size:13.5px; color:var(--p-muted) }
.ct-grade{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px }
.ct-card{ border:0; padding:0; background:none; text-align:left; cursor:pointer; color:var(--p-text); font:inherit }
.ct-capa{ position:relative; aspect-ratio:16/9; border-radius:16px; overflow:hidden; background:var(--p-hover); box-shadow:var(--p-shadow) }
.ct-capa img{ width:100%; height:100%; object-fit:cover; display:block; transition:transform .4s ease }
.ct-card:hover .ct-capa img{ transform:scale(1.05) }
.ct-capa .ct-mini{ position:absolute; left:10px; bottom:10px; width:34px; height:34px; border-radius:50%; background:rgba(0,0,0,.55); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center }
.ct-card h4{ margin:10px 2px 3px; font-size:15.5px; font-weight:650; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden }
.ct-card small{ margin:0 2px; font-size:12.5px; color:var(--p-muted) }
.ct-fotos{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px }
.ct-fotos .ct-capa{ aspect-ratio:1/1 }
.ct-vazio{ background:var(--p-card); border:1px dashed var(--p-line2); border-radius:22px; padding:48px 24px; text-align:center; color:var(--p-muted) }
.ct-modal{ position:fixed; inset:0; z-index:10003; background:rgba(0,0,0,.92); display:flex; align-items:center; justify-content:center; padding:20px }
.ct-modal iframe{ width:min(1200px,96vw); aspect-ratio:16/9; border:0; border-radius:14px; background:#000 }
.ct-modal img{ max-width:96vw; max-height:88vh; object-fit:contain; border-radius:8px }
.ct-modal-x{ position:absolute; top:16px; right:16px; border:0; width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.14); color:#fff; font-size:24px; cursor:pointer }
.ct-modal-info{ position:absolute; left:0; right:0; bottom:18px; text-align:center; color:rgba(255,255,255,.8); font-size:14px; padding:0 20px }
@media (max-width:1100px){ .ct-grade{ grid-template-columns:repeat(2,1fr) } .ct-fotos{ grid-template-columns:repeat(3,1fr) } }
@media (max-width:640px){
  .ct-grade{ grid-template-columns:1fr; gap:16px } .ct-fotos{ grid-template-columns:repeat(2,1fr); gap:6px }
  .ct-destaque{ aspect-ratio:4/3 } .ct-destaque-txt{ left:18px; right:18px; bottom:18px } .ct-destaque-txt h2{ font-size:22px }
  .ct-destaque::after{ background:linear-gradient(0deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 70%) }
}
`;

const Play = ({ t = 16 }: { t?: number }) => <svg width={t} height={t} viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;

export function ConteudoMembro() {
  const [itens, setItens] = useState<Conteudo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("tudo");
  const [aberto, setAberto] = useState<Conteudo | null>(null);
  useEffect(() => {
    supabase.from("conteudos").select("*").eq("ativo", true).order("publicado_em", { ascending: false })
      .then(({ data }) => { setItens((data as Conteudo[]) || []); setCarregando(false); });
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(null); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [aberto]);
  const categorias = useMemo(() => [...new Set(itens.map((i) => i.categoria).filter(Boolean) as string[])].sort(), [itens]);
  const visiveis = itens.filter((i) => filtro === "tudo" || (filtro === "video" ? i.tipo === "video" : filtro === "foto" ? i.tipo === "foto" : i.categoria === filtro));
  const videos = visiveis.filter((i) => i.tipo === "video"), fotos = visiveis.filter((i) => i.tipo === "foto");
  const destaque = videos.find((v) => v.destaque) || videos[0];
  const resto = videos.filter((v) => v.id !== destaque?.id);
  const ytAberto = aberto?.tipo === "video" ? aberto.youtube_id || ytId(aberto.url) : null;

  return (
    <div className="ct">
      <style>{CSS}</style>
      <section style={ui.hero}>
        <div style={ui.heroInner}>
          <div style={ui.heroEyebrow}>Conteúdo</div>
          <h1 style={ui.heroTitle}>Aprenda, reveja e se inspire.</h1>
          <p style={ui.heroSub}>Vídeos do canal do Ecossistema, encontros na íntegra e os melhores momentos da comunidade.</p>
        </div>
      </section>
      {itens.length > 0 && (
        <div className="ct-filtros">
          {[["tudo", "Tudo"], ["video", "Vídeos"], ["foto", "Fotos"], ...categorias.map((c) => [c, c])].map(([id, r]) => (
            <button key={id} className={`ct-filtro${filtro === id ? " on" : ""}`} onClick={() => setFiltro(id)}>{r}</button>
          ))}
        </div>
      )}
      {carregando ? <div className="ct-vazio">Carregando...</div> : itens.length === 0 ? (
        <div className="ct-vazio">
          <div style={{ fontSize: 34, marginBottom: 8 }}>🎬</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "var(--p-text)" }}>Conteúdos chegando em breve</div>
          <div style={{ marginTop: 6 }}>Os vídeos do canal do Ecossistema vão aparecer aqui automaticamente.</div>
        </div>
      ) : (
        <>
          {destaque && (
            <button className="ct-destaque" onClick={() => setAberto(destaque)}>
              <img src={capaDe(destaque).replace("hqdefault", "maxresdefault")} onError={(e) => { (e.target as HTMLImageElement).src = capaDe(destaque); }} alt="" />
              <div className="ct-destaque-txt">
                <small>{destaque.destaque ? "Em destaque" : "Mais recente"}{destaque.categoria ? ` · ${destaque.categoria}` : ""}</small>
                <h2>{destaque.titulo}</h2>
                <span><i className="ct-play"><Play /></i>Assistir agora</span>
              </div>
            </button>
          )}
          {resto.length > 0 && (
            <>
              <div className="ct-secao"><h3>Vídeos</h3><span>{videos.length} {videos.length === 1 ? "vídeo" : "vídeos"}</span></div>
              <div className="ct-grade">
                {resto.map((v) => (
                  <button key={v.id} className="ct-card" onClick={() => setAberto(v)}>
                    <div className="ct-capa"><img src={capaDe(v)} alt="" loading="lazy" /><span className="ct-mini"><Play t={14} /></span></div>
                    <h4>{v.titulo}</h4>
                    <small>{dataBR(v.publicado_em)}{v.categoria ? ` · ${v.categoria}` : ""}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {fotos.length > 0 && (
            <>
              <div className="ct-secao"><h3>Fotos</h3><span>{fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</span></div>
              <div className="ct-fotos">
                {fotos.map((f) => (
                  <button key={f.id} className="ct-card" onClick={() => setAberto(f)} title={f.titulo}>
                    <div className="ct-capa"><img src={capaDe(f)} alt={f.titulo} loading="lazy" /></div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {aberto && (
        <div className="ct-modal" onClick={() => setAberto(null)} role="dialog" aria-label={aberto.titulo}>
          <button className="ct-modal-x" onClick={() => setAberto(null)} aria-label="Fechar">×</button>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "contents" }}>
            {aberto.tipo === "video" && ytAberto
              ? <iframe src={`https://www.youtube.com/embed/${ytAberto}?autoplay=1&rel=0&playsinline=1`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={aberto.titulo} />
              : aberto.tipo === "video" ? <video src={aberto.url} controls autoPlay playsInline style={{ maxWidth: "96vw", maxHeight: "88vh" }} />
              : <img src={aberto.url} alt={aberto.titulo} />}
          </div>
          <div className="ct-modal-info">{aberto.titulo}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ADMINISTRAÇÃO > CONTEÚDO                                            */
/* ------------------------------------------------------------------ */

const VAZIO = { tipo: "video" as "video" | "foto", titulo: "", url: "", categoria: "", destaque: false };

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

  async function sincronizar() {
    setOcupado("sync"); setMsg(null);
    const { data, error } = await supabase.functions.invoke("youtube-sincronizar", { body: {} });
    setOcupado("");
    if (error || data?.erro) { setMsg({ tipo: "erro", texto: data?.erro ? `Não foi possível: ${data.erro}.` : "Não foi possível sincronizar agora." }); return; }
    if (data?.aviso) { setMsg({ tipo: "erro", texto: "Informe o canal do YouTube primeiro." }); return; }
    setMsg({ tipo: "ok", texto: data.novos ? `${data.novos} vídeo(s) novo(s) trazido(s) do canal.` : "Canal conferido: nenhum vídeo novo." });
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
      tipo: novo.tipo, titulo: novo.titulo.trim(), url: novo.url.trim(), categoria: novo.categoria.trim() || null, destaque: novo.destaque,
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
          <button style={ui.botaoSecundario} onClick={sincronizar} disabled={!!ocupado}>{ocupado === "sync" ? "Sincronizando..." : "Sincronizar agora"}</button>
        </div>
      </div>
      <div style={{ ...ui.cartao, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Adicionar manualmente</div>
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
              {c.tipo === "video" ? "Vídeo" : "Foto"} · {dataBR(c.publicado_em)}{c.categoria ? ` · ${c.categoria}` : ""}{c.origem === "youtube" ? " · do canal" : ""}{c.destaque ? " · ★ Destaque" : ""}{!c.ativo ? " · Oculto" : ""}
            </div>
          </div>
          <input style={{ ...ui.input, width: 150, padding: "7px 10px", fontSize: 13 }} placeholder="Categoria" defaultValue={c.categoria || ""}
            onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== c.categoria) alterar(c, { categoria: v }); }} />
          <button style={ui.botaoSecundario} onClick={() => alterar(c, { destaque: !c.destaque })}>{c.destaque ? "Tirar destaque" : "Destacar"}</button>
          <button style={ui.botaoSecundario} onClick={() => alterar(c, { ativo: !c.ativo })}>{c.ativo ? "Ocultar" : "Mostrar"}</button>
          <button style={ui.botaoPerigo} onClick={() => excluir(c)}>Excluir</button>
        </div>
      ))}
    </main>
  );
}
