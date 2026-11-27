// Aba "Ofertas": cada membro divulga os próprios produtos e serviços para os outros membros.
// Até ser liberada (portal_config 'ofertas'), só administradores veem a aba. Limite de 5 ofertas por membro.
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { pegarPedido } from "./Sino";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Dono = { id: string; nome: string; empresa: string | null; foto_url: string | null; telefone_whatsapp: string | null; segmento: string | null };
export type Oferta = {
  id: string; membro_id: string; tipo: "produto" | "servico"; titulo: string; descricao: string;
  condicao_membro: string | null; preco: string | null; link: string | null; imagem_url: string | null;
  ativo: boolean; created_at: string; dono?: Dono | null;
};
type Rascunho = { id?: string; membro_id: string; tipo: "produto" | "servico"; titulo: string; descricao: string; condicao_membro: string; preco: string; link: string; imagem_url: string | null };

export async function ofertasLiberada(): Promise<boolean> {
  const { data } = await supabase.rpc("ofertas_liberada");
  return !!data;
}

const LIMITE = 5;
const iniciais = (t: string) => t.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const soDigitos = (t: string) => t.replace(/\D/g, "");
const foneWa = (t: string) => { const d = soDigitos(t); return d.length <= 11 ? `55${d}` : d; };
const linkValido = (t: string) => !t || /^https?:\/\/\S+\.\S+/i.test(t);
const vazio = (membro_id = ""): Rascunho => ({ membro_id, tipo: "servico", titulo: "", descricao: "", condicao_membro: "", preco: "", link: "", imagem_url: null });

// Reduz a imagem no navegador (máx. 1400 px, JPG) para caber no limite de 2 MB e carregar rápido.
async function reduzir(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    const esc = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("imagem"))), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

const CSS = `
.of{ text-align:left; display:flex; flex-direction:column; gap:22px; min-width:0 }
.of-topo{ display:flex; gap:16px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap }
.of-topo h1{ margin:0 0 6px; font-size:34px; line-height:1.1; font-weight:700; letter-spacing:-.025em; color:var(--p-text) }
.of-topo p{ margin:0; color:var(--p-muted); font-size:16px; max-width:640px; line-height:1.5 }
.of-aviso{ display:flex; gap:14px; align-items:center; justify-content:space-between; flex-wrap:wrap; border:1px dashed color-mix(in srgb, var(--p-accent) 45%, transparent); background:color-mix(in srgb, var(--p-accent) 7%, transparent); color:var(--p-text); border-radius:16px; padding:14px 18px; font-size:14px }
.of-filtros{ display:flex; gap:10px; align-items:center; flex-wrap:wrap }
.of-busca{ flex:1 1 260px; display:flex; align-items:center; gap:10px; background:var(--p-card); border:1px solid var(--p-line2); border-radius:14px; padding:0 14px; height:46px }
.of-busca input{ flex:1; border:0; outline:0; background:transparent; font:inherit; font-size:15px; color:var(--p-text); min-width:0 }
.of-chip{ border:1px solid var(--p-line2); background:var(--p-card); color:var(--p-text); border-radius:980px; padding:9px 15px; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; white-space:nowrap }
.of-chip.on{ background:var(--p-text); color:var(--p-bg, #fff); border-color:var(--p-text) }
.of-grade{ display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:18px }
.of-card{ display:flex; flex-direction:column; background:var(--p-card); border:1px solid var(--p-line); border-radius:20px; overflow:hidden; box-shadow:var(--p-shadow); cursor:pointer; text-align:left; padding:0; font:inherit; color:var(--p-text); transition:transform .2s ease, box-shadow .2s ease; min-width:0 }
.of-card:hover{ transform:translateY(-3px) }
.of-card.pausada{ opacity:.6 }
.of-capa{ position:relative; aspect-ratio:16/10; background:linear-gradient(135deg,#0d3b22,#071c12 60%,#1a1405); overflow:hidden }
.of-capa img{ width:100%; height:100%; object-fit:cover; display:block }
.of-capa .of-ini{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:46px; font-weight:800; letter-spacing:.04em; color:rgba(255,255,255,.88) }
.of-capa .of-ini small{ position:absolute; bottom:12px; left:0; right:0; text-align:center; font-size:11px; letter-spacing:.18em; font-weight:700; color:#C9A24A }
.of-tipo{ position:absolute; top:12px; left:12px; background:rgba(0,0,0,.62); backdrop-filter:blur(6px); color:#fff; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; border-radius:980px; padding:4px 10px }
.of-pausa{ position:absolute; top:12px; right:12px; background:#fff; color:#111; font-size:11px; font-weight:800; border-radius:980px; padding:4px 10px }
.of-corpo{ padding:16px 18px 18px; display:flex; flex-direction:column; gap:9px; flex:1; min-width:0 }
.of-corpo h3{ margin:0; font-size:17px; font-weight:700; line-height:1.3; letter-spacing:-.01em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden }
.of-desc{ margin:0; font-size:14px; line-height:1.5; color:var(--p-muted); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden }
.of-cond{ align-self:flex-start; display:inline-flex; gap:6px; align-items:center; background:linear-gradient(90deg,#F3DE9A,#C9A24A); color:#2a1d02; font-size:12px; font-weight:750; border-radius:980px; padding:5px 11px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.of-preco{ font-size:14px; font-weight:700; color:var(--p-text) }
.of-dono{ display:flex; gap:10px; align-items:center; margin-top:auto; padding-top:12px; border-top:1px solid var(--p-line); min-width:0 }
.of-av{ width:36px; height:36px; border-radius:50%; flex:none; object-fit:cover; background:var(--p-accent-bg, #e8f5ec); color:var(--p-accent-text); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800 }
.of-dono div{ min-width:0 } .of-dono strong{ display:block; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.of-dono div span{ display:block; font-size:12px; color:var(--p-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.of-vazio{ background:var(--p-card); border:1px dashed var(--p-line2); border-radius:22px; padding:48px 24px; text-align:center; color:var(--p-muted) }
.of-vazio h3{ color:var(--p-text); margin:0 0 6px; font-size:19px }
.of-modal{ position:fixed; inset:0; z-index:10003; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; overflow-y:auto }
.of-caixa{ position:relative; width:min(720px,100%); background:var(--p-card); color:var(--p-text); border-radius:24px; box-shadow:0 30px 80px rgba(0,0,0,.35); overflow:hidden }
.of-caixa .of-capa{ aspect-ratio:16/8 }
.of-x{ position:absolute; top:12px; right:12px; z-index:2; width:40px; height:40px; border-radius:50%; border:0; background:rgba(0,0,0,.55); color:#fff; font-size:22px; cursor:pointer }
.of-det{ padding:22px 24px 24px; display:flex; flex-direction:column; gap:14px }
.of-det h2{ margin:0; font-size:24px; line-height:1.2; letter-spacing:-.02em }
.of-det p{ margin:0; white-space:pre-wrap; line-height:1.6; font-size:15px; color:var(--p-text2, var(--p-text)) }
.of-bts{ display:flex; gap:10px; flex-wrap:wrap }
.of-wa{ display:inline-flex; align-items:center; gap:8px; background:#1F8F4E; color:#fff; border:0; border-radius:980px; padding:12px 20px; font:inherit; font-size:15px; font-weight:700; cursor:pointer; text-decoration:none }
.of-form{ padding:24px; display:flex; flex-direction:column; gap:14px }
.of-form h2{ margin:0 0 4px; font-size:22px; letter-spacing:-.02em }
.of-linha{ display:grid; grid-template-columns:1fr 1fr; gap:12px }
.of-seg{ display:flex; gap:8px }
.of-conta{ font-size:12px; color:var(--p-muted); text-align:right; margin-top:4px }
.of-img{ display:flex; gap:14px; align-items:center; flex-wrap:wrap }
.of-img .of-prev{ width:140px; aspect-ratio:16/10; border-radius:12px; overflow:hidden; background:var(--p-hover); flex:none }
.of-img .of-prev img{ width:100%; height:100%; object-fit:cover; display:block }
@media (max-width:640px){ .of-topo h1{ font-size:28px } .of-linha{ grid-template-columns:1fr } .of-det, .of-form{ padding:18px } }
`;

function Capa({ o }: { o: Oferta }) {
  return (
    <div className="of-capa">
      {o.imagem_url
        ? <img src={o.imagem_url} alt="" loading="lazy" />
        : <div className="of-ini">{iniciais(o.dono?.empresa || o.dono?.nome || o.titulo)}<small>ECOSSISTEMA</small></div>}
      <span className="of-tipo">{o.tipo === "produto" ? "Produto" : "Serviço"}</span>
      {!o.ativo && <span className="of-pausa">Pausada</span>}
    </div>
  );
}

function Avatar({ d }: { d?: Dono | null }) {
  if (d?.foto_url) return <img className="of-av" src={d.foto_url} alt="" />;
  return <span className="of-av">{iniciais(d?.nome || "?")}</span>;
}

export function Ofertas({ admin, somenteVer }: { admin: boolean; somenteVer?: boolean }) {
  const [lista, setLista] = useState<Oferta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [meuId, setMeuId] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [liberada, setLiberada] = useState(true);
  const [membrosAdm, setMembrosAdm] = useState<{ id: string; nome: string; empresa: string | null }[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "produto" | "servico" | "condicao" | "minhas">("todas");
  const [aberta, setAberta] = useState<Oferta | null>(null);
  const [form, setForm] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoImg, setEnviandoImg] = useState(false);
  const [msgForm, setMsgForm] = useState("");
  const [confirmaApagar, setConfirmaApagar] = useState<string | null>(null);
  const [confirmaLiberar, setConfirmaLiberar] = useState(false);

  async function carregar() {
    setErro("");
    const { data, error } = await supabase.from("ofertas")
      .select("id,membro_id,tipo,titulo,descricao,condicao_membro,preco,link,imagem_url,ativo,created_at,dono:membros(id,nome,empresa,foto_url,telefone_whatsapp,segmento)")
      .order("created_at", { ascending: false });
    if (error) setErro("Não foi possível carregar as ofertas agora.");
    const l = ((data || []) as unknown as Oferta[]);
    setLista(l);
    setCarregando(false);
    abrirPedido(l);
  }
  // Link direto para uma oferta (sino do portal ou link do WhatsApp: #ofertas/<id>).
  function abrirPedido(l: Oferta[]) {
    const id = pegarPedido("ofertas");
    if (!id) return;
    const o = l.find((x) => x.id === id);
    if (o) setAberta(o);
    if (window.location.hash !== "#ofertas") history.replaceState(null, "", "#ofertas");
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u.user?.id || null;
      setUid(id);
      if (id) {
        const { data: m } = await supabase.from("membros").select("id,equipe").eq("auth_user_id", id).eq("ativo", true).maybeSingle();
        if (m && !m.equipe) setMeuId(m.id);
      }
      setLiberada(await ofertasLiberada());
      if (admin) {
        const { data: ms } = await supabase.from("membros").select("id,nome,empresa").eq("ativo", true).eq("equipe", false).order("nome");
        setMembrosAdm(ms || []);
      }
      await carregar();
    })();
  }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ouvir = () => abrirPedido(lista);
    window.addEventListener("portal:abrir", ouvir);
    return () => window.removeEventListener("portal:abrir", ouvir);
  }, [lista]); // eslint-disable-line react-hooks/exhaustive-deps

  const minhas = useMemo(() => lista.filter((o) => o.membro_id === meuId), [lista, meuId]);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista
      .filter((o) => (filtro === "minhas" ? o.membro_id === meuId : (o.ativo || o.membro_id === meuId || admin)))
      .filter((o) => filtro === "produto" || filtro === "servico" ? o.tipo === filtro : true)
      .filter((o) => filtro === "condicao" ? !!o.condicao_membro : true)
      .filter((o) => !t || [o.titulo, o.descricao, o.condicao_membro, o.dono?.nome, o.dono?.empresa, o.dono?.segmento].some((x) => (x || "").toLowerCase().includes(t)));
  }, [lista, busca, filtro, meuId, admin]);

  const podeEditar = (o: Oferta) => !somenteVer && (admin || o.membro_id === meuId);
  const podeCriar = !somenteVer && (admin || (!!meuId && minhas.length < LIMITE));

  function abrirNova() {
    setMsgForm("");
    setForm(vazio(meuId || (admin ? "" : "")));
  }
  function editar(o: Oferta) {
    setAberta(null); setMsgForm("");
    setForm({ id: o.id, membro_id: o.membro_id, tipo: o.tipo, titulo: o.titulo, descricao: o.descricao, condicao_membro: o.condicao_membro || "", preco: o.preco || "", link: o.link || "", imagem_url: o.imagem_url });
  }

  async function enviarImagem(e: ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq || !form || !uid) return;
    if (!/^image\/(jpeg|png|webp)$/.test(arq.type)) { setMsgForm("Use uma imagem JPG, PNG ou WEBP."); return; }
    setEnviandoImg(true); setMsgForm("");
    try {
      const blob = await reduzir(arq);
      const caminho = `${uid}/oferta-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("fotos-membros").upload(caminho, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setForm({ ...form, imagem_url: supabase.storage.from("fotos-membros").getPublicUrl(caminho).data.publicUrl });
    } catch {
      setMsgForm("Não foi possível enviar a imagem. Tente outra.");
    }
    setEnviandoImg(false);
  }

  async function salvar() {
    if (!form) return;
    const f = { ...form, titulo: form.titulo.trim(), descricao: form.descricao.trim(), condicao_membro: form.condicao_membro.trim(), preco: form.preco.trim(), link: form.link.trim() };
    if (!f.membro_id) return setMsgForm("Escolha o membro dono da oferta.");
    if (f.titulo.length < 3) return setMsgForm("Escreva o nome da oferta.");
    if (f.descricao.length < 10) return setMsgForm("Descreva a oferta em pelo menos uma frase.");
    if (f.link && !/^https?:\/\//i.test(f.link)) f.link = `https://${f.link}`;
    if (!linkValido(f.link)) return setMsgForm("O link não parece válido.");
    setSalvando(true); setMsgForm("");
    const corpo = { tipo: f.tipo, titulo: f.titulo, descricao: f.descricao, condicao_membro: f.condicao_membro || null, preco: f.preco || null, link: f.link || null, imagem_url: f.imagem_url };
    const { error } = f.id
      ? await supabase.from("ofertas").update(corpo).eq("id", f.id)
      : await supabase.from("ofertas").insert({ ...corpo, membro_id: f.membro_id });
    setSalvando(false);
    if (error) return setMsgForm(/Limite/.test(error.message) ? "Cada membro pode ter até 5 ofertas." : "Não foi possível salvar. Confira os campos e tente de novo.");
    setForm(null);
    carregar();
  }

  async function alternar(o: Oferta) {
    await supabase.from("ofertas").update({ ativo: !o.ativo }).eq("id", o.id);
    setAberta(null); carregar();
  }
  async function apagar(id: string) {
    await supabase.from("ofertas").delete().eq("id", id);
    setConfirmaApagar(null); setAberta(null); carregar();
  }
  async function liberar() {
    const { error } = await supabase.from("portal_config").update({ valor: JSON.stringify({ liberada: true }), atualizado_em: new Date().toISOString() }).eq("chave", "ofertas");
    if (!error) setLiberada(true);
    setConfirmaLiberar(false);
  }

  const whats = (o: Oferta) => {
    const f = o.dono?.telefone_whatsapp;
    if (!f) return null;
    const primeiro = (o.dono?.nome || "").split(" ")[0];
    return `https://wa.me/${foneWa(f)}?text=${encodeURIComponent(`Olá, ${primeiro}! Vi sua oferta "${o.titulo}" no portal do Ecossistema e quero saber mais.`)}`;
  };

  return (
    <div className="of">
      <style>{CSS}</style>
      <div className="of-topo">
        <div>
          <div style={ui.heroEyebrow}>Produtos e serviços dos membros</div>
          <h1>Ofertas</h1>
          <p>O que cada empresa do Ecossistema oferece, com condições especiais para quem é membro. Fale direto com o dono pelo WhatsApp.</p>
        </div>
        {podeCriar && <button style={ui.botao} onClick={abrirNova}>+ Nova oferta</button>}
        {!somenteVer && !admin && meuId && minhas.length >= LIMITE && <span style={{ fontSize: 13, color: "var(--p-muted)" }}>Você já tem {LIMITE} ofertas (o máximo).</span>}
      </div>

      {admin && !somenteVer && !liberada && (
        <div className="of-aviso">
          <span><strong>Prévia:</strong> por enquanto só administradores veem esta aba. Os membros ainda não veem nada.</span>
          {confirmaLiberar
            ? <span style={{ display: "flex", gap: 8 }}><button style={ui.botao} onClick={liberar}>Sim, liberar agora</button><button style={ui.botaoSecundario} onClick={() => setConfirmaLiberar(false)}>Cancelar</button></span>
            : <button style={ui.botaoSecundario} onClick={() => setConfirmaLiberar(true)}>Liberar para os membros</button>}
        </div>
      )}

      <div className="of-filtros">
        <label className="of-busca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--p-muted)" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por produto, serviço, empresa ou segmento" />
        </label>
        {([["todas", "Todas"], ["servico", "Serviços"], ["produto", "Produtos"], ["condicao", "Condição para membros"], ...(meuId && !somenteVer ? [["minhas", `Minhas (${minhas.length})`]] : [])] as [typeof filtro, string][]).map(([k, t]) => (
          <button key={k} className={`of-chip${filtro === k ? " on" : ""}`} onClick={() => setFiltro(k)}>{t}</button>
        ))}
      </div>

      {erro && <div style={ui.erro}>{erro}</div>}
      {carregando ? <div style={ui.aviso}>Carregando ofertas…</div>
        : visiveis.length === 0 ? (
          <div className="of-vazio">
            <h3>{lista.length === 0 ? "Nenhuma oferta publicada ainda" : "Nada encontrado"}</h3>
            <div>{lista.length === 0 ? "Seja o primeiro a mostrar o que a sua empresa oferece aos membros." : "Tente outra busca ou outro filtro."}</div>
            {lista.length === 0 && podeCriar && <button style={{ ...ui.botao, marginTop: 16 }} onClick={abrirNova}>+ Publicar minha oferta</button>}
          </div>
        ) : (
          <div className="of-grade">
            {visiveis.map((o) => (
              <button key={o.id} className={`of-card${o.ativo ? "" : " pausada"}`} onClick={() => setAberta(o)}>
                <Capa o={o} />
                <div className="of-corpo">
                  <h3>{o.titulo}</h3>
                  {o.condicao_membro && <span className="of-cond">★ {o.condicao_membro}</span>}
                  <p className="of-desc">{o.descricao}</p>
                  {o.preco && <div className="of-preco">{o.preco}</div>}
                  <div className="of-dono"><Avatar d={o.dono} /><div><strong>{o.dono?.nome}</strong><span>{o.dono?.empresa || o.dono?.segmento || "Membro Master"}</span></div></div>
                </div>
              </button>
            ))}
          </div>
        )}

      {aberta && (
        <div className="of-modal" onClick={() => { setAberta(null); setConfirmaApagar(null); }}>
          <div className="of-caixa" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="of-x" onClick={() => setAberta(null)} aria-label="Fechar">×</button>
            <Capa o={aberta} />
            <div className="of-det">
              <h2>{aberta.titulo}</h2>
              {aberta.condicao_membro && <span className="of-cond">★ {aberta.condicao_membro}</span>}
              <p>{aberta.descricao}</p>
              {aberta.preco && <div className="of-preco">{aberta.preco}</div>}
              <div className="of-dono" style={{ marginTop: 0 }}><Avatar d={aberta.dono} /><div><strong>{aberta.dono?.nome}</strong><span>{[aberta.dono?.empresa, aberta.dono?.segmento].filter(Boolean).join(" · ") || "Membro Master"}</span></div></div>
              <div className="of-bts">
                {whats(aberta) && <a className="of-wa" href={whats(aberta)!} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>}
                {aberta.link && <a style={{ ...ui.botaoSecundario, padding: "12px 20px", fontSize: 15, textDecoration: "none" }} href={aberta.link} target="_blank" rel="noopener noreferrer">Ver mais ↗</a>}
              </div>
              {podeEditar(aberta) && (
                <div className="of-bts" style={{ borderTop: "1px solid var(--p-line)", paddingTop: 14 }}>
                  <button style={ui.botaoSecundario} onClick={() => editar(aberta)}>Editar</button>
                  <button style={ui.botaoSecundario} onClick={() => alternar(aberta)}>{aberta.ativo ? "Pausar" : "Reativar"}</button>
                  {confirmaApagar === aberta.id
                    ? <><button style={ui.botaoPerigo} onClick={() => apagar(aberta.id)}>Confirmar exclusão</button><button style={ui.botaoSecundario} onClick={() => setConfirmaApagar(null)}>Cancelar</button></>
                    : <button style={ui.botaoPerigo} onClick={() => setConfirmaApagar(aberta.id)}>Excluir</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="of-modal" onClick={() => !salvando && setForm(null)}>
          <div className="of-caixa" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="of-x" onClick={() => setForm(null)} aria-label="Fechar">×</button>
            <div className="of-form">
              <h2>{form.id ? "Editar oferta" : "Nova oferta"}</h2>
              {admin && !form.id && (
                <div>
                  <label style={ui.label}>Membro dono da oferta</label>
                  <select style={ui.input} value={form.membro_id} onChange={(e) => setForm({ ...form, membro_id: e.target.value })}>
                    <option value="">Escolha…</option>
                    {membrosAdm.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.empresa ? ` · ${m.empresa}` : ""}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={ui.label}>Tipo</label>
                <div className="of-seg">
                  {(["servico", "produto"] as const).map((t) => <button key={t} type="button" className={`of-chip${form.tipo === t ? " on" : ""}`} onClick={() => setForm({ ...form, tipo: t })}>{t === "servico" ? "Serviço" : "Produto"}</button>)}
                </div>
              </div>
              <div>
                <label style={ui.label}>Nome da oferta</label>
                <input style={ui.input} maxLength={90} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Consultoria tributária para empresas do Simples" />
              </div>
              <div>
                <label style={ui.label}>Descrição</label>
                <textarea style={{ ...ui.input, minHeight: 120, resize: "vertical" }} maxLength={1200} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="O que é, para quem serve e o que a pessoa recebe." />
                <div className="of-conta">{form.descricao.length}/1200</div>
              </div>
              <div>
                <label style={ui.label}>Condição especial para membros <span style={{ fontWeight: 400, color: "var(--p-muted)" }}>(opcional)</span></label>
                <input style={ui.input} maxLength={200} value={form.condicao_membro} onChange={(e) => setForm({ ...form, condicao_membro: e.target.value })} placeholder="Ex.: 15% de desconto ou diagnóstico gratuito" />
              </div>
              <div className="of-linha">
                <div>
                  <label style={ui.label}>Preço <span style={{ fontWeight: 400, color: "var(--p-muted)" }}>(opcional)</span></label>
                  <input style={ui.input} maxLength={60} value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} placeholder="Ex.: a partir de R$ 490" />
                </div>
                <div>
                  <label style={ui.label}>Link <span style={{ fontWeight: 400, color: "var(--p-muted)" }}>(opcional)</span></label>
                  <input style={ui.input} maxLength={300} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="site, catálogo ou Instagram" />
                </div>
              </div>
              <div>
                <label style={ui.label}>Imagem <span style={{ fontWeight: 400, color: "var(--p-muted)" }}>(opcional)</span></label>
                <div className="of-img">
                  <div className="of-prev">{form.imagem_url ? <img src={form.imagem_url} alt="" /> : null}</div>
                  <label style={{ ...ui.botaoSecundario, display: "inline-block" }}>
                    {enviandoImg ? "Enviando…" : form.imagem_url ? "Trocar imagem" : "Enviar imagem"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={enviarImagem} disabled={enviandoImg} />
                  </label>
                  {form.imagem_url && <button type="button" style={ui.botaoSecundario} onClick={() => setForm({ ...form, imagem_url: null })}>Remover</button>}
                </div>
              </div>
              {msgForm && <div style={ui.erro}>{msgForm}</div>}
              <div className="of-bts" style={{ justifyContent: "flex-end" }}>
                <button style={ui.botaoSecundario} onClick={() => setForm(null)} disabled={salvando}>Cancelar</button>
                <button style={ui.botao} onClick={salvar} disabled={salvando || enviandoImg}>{salvando ? "Salvando…" : form.id ? "Salvar" : "Publicar oferta"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
