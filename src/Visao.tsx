import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "./supabase";

// Novo visual do portal (tema escuro, verde neon), reproduzindo a referência aprovada.
// PortalShell = menu lateral + barra do topo. VisaoGeral = painel inicial do membro.

export const V = {
  fundo: "#06090A", fundo2: "#0A0F0D", painel: "#0D1512", painel2: "#101A16", borda: "#1B2A23", borda2: "#24392F",
  verde: "#2BE36B", verde2: "#1FC85A", verdeEsc: "#0E5A2C", texto: "#E9F0EC", suave: "#97A69E", claro: "#6B7A72",
};

export const CSS_V = `
.pv{ min-height:100vh; background:${V.fundo}; color:${V.texto}; display:grid; grid-template-columns:186px 1fr; text-align:left; line-height:1.35; letter-spacing:normal;
  font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif; width:100vw; margin-left:calc(50% - 50vw); box-sizing:border-box }
.pv *{ box-sizing:border-box } .pv h1,.pv h2,.pv h3,.pv p{ line-height:1.2 } .pv svg{ flex:0 0 auto }
.pv-side{ background:linear-gradient(180deg,#070B09 0%,#050807 100%); border-right:1px solid ${V.borda}; padding:16px 12px; display:flex; flex-direction:column; gap:4px; position:sticky; top:0; height:100vh; overflow-y:auto }
.pv-item{ display:flex; align-items:center; gap:11px; padding:10px 10px; border-radius:10px; color:#C9D3CD; font:inherit; font-size:13.5px; font-weight:600; border:0; background:transparent; cursor:pointer; width:100%; text-align:left }
.pv-item:hover{ background:#0F1915; color:#fff }
.pv-item.on{ background:linear-gradient(90deg,#0F5C2E 0%,#0B3A1E 100%); color:#fff; box-shadow:inset 3px 0 0 ${V.verde}, 0 0 18px -6px ${V.verde}88 }
.pv-item.on svg{ color:${V.verde} }
.pv-item.off{ opacity:.45; cursor:default }
.pv-main{ min-width:0; display:flex; flex-direction:column }
.pv-top{ height:64px; display:flex; align-items:center; gap:18px; padding:0 28px; border-bottom:1px solid ${V.borda}; background:rgba(6,9,10,.85); backdrop-filter:blur(10px); position:sticky; top:0; z-index:20 }
.pv-busca{ flex:0 1 470px; margin:0 auto; display:flex; align-items:center; gap:10px; height:38px; border-radius:12px; background:#0C1311; border:1px solid ${V.borda2}; padding:0 12px; color:${V.suave} }
.pv-busca input{ flex:1; background:transparent; border:0; outline:0; color:${V.texto}; font:inherit; font-size:13.5px }
.pv-kbd{ font-size:11px; border:1px solid ${V.borda2}; border-radius:6px; padding:2px 6px; color:${V.suave} }
.pv-conteudo{ padding:22px 26px 34px; display:flex; flex-direction:column; gap:18px }
.pv-card{ background:linear-gradient(180deg,#0E1714 0%,#0B1210 100%); border:1px solid ${V.borda}; border-radius:14px; box-shadow:inset 0 1px 0 rgba(255,255,255,.03) }
.pv-glow{ border-color:#1F4A31; box-shadow:inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(43,227,107,.06), 0 10px 30px -18px rgba(43,227,107,.45) }
.pv-kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px }
.pv-meio{ display:grid; grid-template-columns:1fr 318px; gap:16px }
.pv-ops{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px }
.pv-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; height:36px; border-radius:10px; border:0; background:linear-gradient(180deg,#43F07F 0%,#22D262 100%); color:#03140A; font:inherit; font-weight:800; font-size:13.5px; cursor:pointer; box-shadow:0 6px 18px -8px ${V.verde}, inset 0 1px 0 rgba(255,255,255,.35) }
.pv-btn:hover{ filter:brightness(1.06) }
.pv-btn2{ display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 12px; border-radius:100px; border:1px solid ${V.borda2}; background:#0B1210; color:${V.texto}; font:inherit; font-size:12px; font-weight:700; cursor:pointer }
.pv-btn2:hover{ border-color:${V.verde} }
.pv-link{ color:${V.verde}; font-size:12px; font-weight:700; background:none; border:0; cursor:pointer; font-family:inherit; display:inline-flex; gap:4px; align-items:center }
.pv-seg{ display:flex; gap:2px; background:#0A100E; border:1px solid ${V.borda2}; border-radius:100px; padding:3px }
.pv-seg button{ border:0; background:transparent; color:${V.texto}; font:inherit; font-size:11.5px; font-weight:700; padding:5px 12px; border-radius:100px; cursor:pointer }
.pv-seg button.on{ background:${V.verde}; color:#03140A }
.pv-chip{ display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:800; color:${V.verde}; background:rgba(43,227,107,.12); border:1px solid rgba(43,227,107,.28); border-radius:100px; padding:3px 8px }
@media (max-width:1180px){ .pv-meio{ grid-template-columns:1fr } .pv-ops{ grid-template-columns:repeat(2,1fr) } }
@media (max-width:900px){
  .pv{ grid-template-columns:1fr } .pv-side{ position:static; height:auto; flex-direction:row; overflow-x:auto; padding:10px }
  .pv-side > div:not(.pv-logo):not(.pv-promo){ display:contents !important } .pv-side .pv-logo, .pv-side .pv-promo, .pv-kbd{ display:none !important } .pv-side{ flex-wrap:nowrap; gap:4px } .pv-grafico{ grid-template-columns:1fr !important }
  .pv-side .pv-logo, .pv-side .pv-promo{ display:none } .pv-item{ width:auto; white-space:nowrap }
  .pv-kpis{ grid-template-columns:repeat(2,1fr) } .pv-ops{ grid-template-columns:1fr } .pv-top{ padding:0 14px } .pv-conteudo{ padding:16px 14px 28px }
  .pv-quem-txt{ display:none !important }
}`;

export type IconeV = "casa" | "aperto" | "pessoas" | "rede" | "cal" | "dados" | "ferramenta" | "eu" | "engrenagem" | "ajuda" | "sino" | "busca" | "grafico" | "raio" | "estrela" | "pino" | "maleta" | "info" | "foguete" | "seta" | "check" | "escudo" | "play" | "seta-baixo" | "tag" | "sair";
export function Ic({ n, t = 18 }: { n: IconeV; t?: number }) {
  const p: Record<IconeV, ReactNode> = {
    casa: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
    aperto: <><path d="M2 12l4-4 3 2 3-3 3 3 3-2 4 4" /><path d="M6 14l3 3 2-2 2 2 2-2 3 3" /></>,
    pessoas: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14.2c2.9.3 5 2.6 5 5.8" /></>,
    rede: <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="7" r="2.4" /><circle cx="9" cy="18" r="2.4" /><circle cx="18" cy="17" r="2" /><path d="M8 7.5l1 8M8.2 5.6l7.4.9M11.3 17.6l4.7-.4M17.8 9.4l.1 5.6" /></>,
    cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    dados: <><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="4" rx="1.5" /><rect x="13" y="10" width="8" height="10" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /></>,
    ferramenta: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="16" r="3" /><path d="M10.5 10.5l3 3M14 5h5v5M5 14v5h5" /></>,
    eu: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
    engrenagem: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
    ajuda: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 2.2-2.5 4M12 17.5v.01" /></>,
    sino: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    busca: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
    grafico: <><path d="M4 20V13M9.5 20V8M15 20v-5M20.5 20V4" /></>,
    raio: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
    estrela: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
    pino: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
    maleta: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5h6v2M3 12h18" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></>,
    foguete: <><path d="M5 19c1-3 2-4 4-5l1 1c-1 2-2 3-5 4z" /><path d="M10 14l-1-1c2-6 6-9 12-10-1 6-4 10-10 12z" /><circle cx="15" cy="9" r="1.6" /></>,
    seta: <path d="M5 12h14M13 6l6 6-6 6" />,
    check: <path d="M5 12l4 4 10-10" />,
    escudo: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
    play: <path d="M8 5l11 7-11 7z" />,
    "seta-baixo": <path d="M6 9l6 6 6-6" />,
    tag: <><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
    sair: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  };
  return <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[n]}</svg>;
}

// Marca "M" verde (reprodução da referência).
export function LogoM({ t = 44 }: { t?: number }) {
  return (
    <svg width={t * 1.25} height={t} viewBox="0 0 60 48" aria-hidden="true">
      <defs><linearGradient id="lgm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4CF58A" /><stop offset="1" stopColor="#13A84A" /></linearGradient></defs>
      <path d="M2 46 L16 6 L30 30 L44 6 L58 46 H46 L42 30 L30 46 L18 30 L14 46 Z" fill="url(#lgm)" />
      <path d="M16 6 L22 24 L30 30 Z" fill="#0B6B30" opacity=".55" />
      <path d="M44 6 L38 24 L30 30 Z" fill="#0B6B30" opacity=".55" />
    </svg>
  );
}

export type ItemMenu = { id: string; titulo: string; icone: IconeV; badge?: number; pronto?: boolean };

export function PortalShell({ itens, ativo, onIr, nome, papel, foto, onSair, busca, onBusca, children }: {
  itens: ItemMenu[][]; ativo: string; onIr: (id: string) => void; nome: string; papel: string; foto?: string | null;
  onSair: () => void; busca?: string; onBusca?: (t: string) => void; children: ReactNode;
}) {
  const [menuUser, setMenuUser] = useState(false);
  return (
    <div className="pv">
      <style>{CSS_V}</style>
      <aside className="pv-side">
        <div className="pv-logo" style={{ textAlign: "center", padding: "6px 4px 18px" }}>
          <img src="/logo-ecossistema.png" alt="Ecossistema Master Business" style={{ width: 58, height: 58, borderRadius: 14, display: "block", margin: "0 auto 6px", boxShadow: "0 0 22px -6px rgba(43,227,107,.6)" }} />
          <div style={{ fontSize: 13, color: "#DDE6E1", marginTop: 2 }}>Ecossistema</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: -0.2 }}>Master Business</div>
          <div style={{ fontSize: 8.5, color: V.suave, marginTop: 4 }}>Conectando Negócios • Multiplicando Resultados</div>
        </div>
        {itens.map((grupo, gi) => (
          <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: gi ? 14 : 0 }}>
            {grupo.map((it) => (
              <button key={it.id} className={`pv-item${ativo === it.id ? " on" : ""}${it.pronto === false ? " off" : ""}`}
                onClick={() => it.pronto !== false && onIr(it.id)} title={it.pronto === false ? "Em breve" : undefined}>
                <Ic n={it.icone} />
                <span style={{ flex: 1 }}>{it.titulo}</span>
                {!!it.badge && <span style={{ background: V.verde, color: "#03140A", borderRadius: 100, fontSize: 10.5, fontWeight: 800, padding: "1px 7px" }}>{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="pv-promo pv-card pv-glow" style={{ marginTop: "auto", padding: "16px 12px", textAlign: "center" }}>
          <svg width="56" height="34" viewBox="0 0 56 34" aria-hidden="true"><path d="M2 30 L18 18 L28 24 L50 4" fill="none" stroke={V.verde} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M40 4 H50 V14" fill="none" stroke={V.verde} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ fontWeight: 800, fontSize: 14, margin: "6px 0 4px", lineHeight: 1.2 }}>Juntos somos<br />mais fortes!</div>
          <div style={{ fontSize: 10.5, color: V.suave, lineHeight: 1.4 }}>Faça conexões estratégicas e acelere seus resultados.</div>
          <button className="pv-btn2" style={{ marginTop: 12, borderColor: V.verde, color: V.verde }} onClick={() => onIr("entregas")}><Ic n="play" t={12} />Ver Vídeo</button>
        </div>
      </aside>

      <div className="pv-main">
        <header className="pv-top">
          <label className="pv-busca">
            <Ic n="busca" t={17} />
            <input placeholder="Buscar empresas, membros, oportunidades..." value={busca || ""} onChange={(e) => onBusca?.(e.target.value)} />
            <span className="pv-kbd">Ctrl + K</span>
          </label>
          <button title="Notificações" style={{ background: "none", border: 0, color: V.texto, cursor: "pointer", position: "relative", padding: 6 }}><Ic n="sino" t={20} /></button>
          <div className="pv-quem" style={{ position: "relative" }}>
            <button onClick={() => setMenuUser(!menuUser)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: 0, color: V.texto, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              {foto ? <img src={foto} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${V.borda2}` }} />
                : <span style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(145deg,#1B3A28,#0E1F16)", border: `2px solid ${V.borda2}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{(nome || "?").charAt(0)}</span>}
              <span className="pv-quem-txt" style={{ textAlign: "left" }}><span style={{ display: "block", fontWeight: 800, fontSize: 14 }}>{nome}</span><span style={{ display: "block", fontSize: 11.5, color: V.suave }}>{papel}</span></span>
              <Ic n="seta-baixo" t={16} />
            </button>
            {menuUser && (
              <div className="pv-card" style={{ position: "absolute", right: 0, top: 48, padding: 6, minWidth: 170, zIndex: 30 }}>
                <button className="pv-item" onClick={() => { setMenuUser(false); onSair(); }}><Ic n="sair" />Sair</button>
              </div>
            )}
          </div>
        </header>
        <div className="pv-conteudo">{children}</div>
      </div>
    </div>
  );
}

// ---------- Visão geral ----------
type TipoOp = "cliente" | "ajuda" | "parceria" | "afinidade";
export type Op = { id: string; tipo: TipoOp; motivo: string; forca: number; status: string; gerado_em: string; atualizado_em: string;
  alvo: { nome: string | null; empresa: string | null; segmento: string | null; cidade: string | null; estado: string | null; foto_url: string | null; logo_url: string | null; telefone_whatsapp: string | null } | null };
export type EventoV = { id: string; titulo: string; quando: string; dataOrdenacao: string; trilha: string };

const ROT: Record<TipoOp, string> = { cliente: "Cliente potencial", ajuda: "Solução para você", parceria: "Parceria", afinidade: "Afinidade" };
const pct = (f: number) => (f >= 3 ? 95 : f === 2 ? 82 : 64);

function Kpi({ icone, valor, rotulo, serie }: { icone: IconeV; valor: number; rotulo: string; serie: number[] }) {
  const max = Math.max(1, ...serie);
  const pts = serie.map((v, i) => `${(i / Math.max(1, serie.length - 1)) * 100},${34 - (v / max) * 30}`).join(" ");
  return (
    <div className="pv-card pv-glow" style={{ padding: "16px 16px 14px", display: "flex", alignItems: "center", gap: 14, position: "relative", overflow: "hidden", minHeight: 76 }}>
      <span style={{ width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#1C4A30,#0C1F15)", border: "1px solid #1F4A31", color: V.verde, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px -6px ${V.verde}` }}><Ic n={icone} t={22} /></span>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: -0.5 }}>{valor}</div>
        <div style={{ fontSize: 12, color: "#C9D3CD", marginTop: 6 }}>{rotulo}</div>
      </div>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ position: "absolute", right: 12, top: 14, width: 74, height: 30 }} aria-hidden="true">
        <defs><linearGradient id={`k${rotulo.length}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={V.verde} stopOpacity=".35" /><stop offset="1" stopColor={V.verde} stopOpacity="0" /></linearGradient></defs>
        <polygon points={`0,36 ${pts} 100,36`} fill={`url(#k${rotulo.length})`} />
        <polyline points={pts} fill="none" stroke={V.verde} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function abrirWhatsapp(n?: string | null) {
  const t = (n || "").replace(/\D/g, "");
  if (t) window.open(`https://wa.me/${t.startsWith("55") ? t : `55${t}`}`, "_blank", "noopener");
}

export function VisaoGeral({ userId, nome, eventos, confirmacoes, onIr, demo }: {
  userId: string; nome: string; eventos: EventoV[]; confirmacoes: Record<string, string>; onIr: (id: string) => void;
  demo?: { ops: Op[]; membros: { nome: string; created_at: string }[] }; // só para pré-visualização
}) {
  const [ops, setOps] = useState<Op[]>([]);
  const [crescimento, setCrescimento] = useState<string[]>([]); // datas de entrada dos membros
  const [novos, setNovos] = useState<{ nome: string; created_at: string }[]>([]);
  const [periodo, setPeriodo] = useState(30);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (demo) {
      setOps(demo.ops); setNovos(demo.membros.slice(0, 2));
      setCrescimento(demo.membros.map((x) => x.created_at).sort()); return;
    }
    (async () => {
      const { data: eu } = await supabase.from("membros").select("id").eq("auth_user_id", userId).maybeSingle();
      const [{ data: o }, { data: ms }] = await Promise.all([
        eu ? supabase.from("membros_oportunidades")
          .select("id,tipo,motivo,forca,status,gerado_em,atualizado_em,alvo:membros!membros_oportunidades_alvo_id_fkey(nome,empresa,segmento,cidade,estado,foto_url,logo_url,telefone_whatsapp)")
          .eq("membro_id", eu.id) : Promise.resolve({ data: [] }),
        supabase.from("membros").select("nome,created_at").eq("ativo", true).eq("equipe", false).order("created_at", { ascending: false }),
      ]);
      setOps(((o as unknown as Op[]) || []).filter((x) => x.alvo && x.status !== "descartada"));
      const lista = (ms as { nome: string; created_at: string }[]) || [];
      setNovos(lista.slice(0, 3));
      setCrescimento(lista.map((x) => x.created_at).filter(Boolean).sort());
    })();
  }, [userId]);

  const conta = (t: TipoOp) => ops.filter((x) => x.tipo === t).length;
  const top = useMemo(() => [...ops].sort((a, b) => b.forca - a.forca).slice(0, 3), [ops]);
  const match = ops.length ? Math.round(ops.reduce((s, x) => s + pct(x.forca), 0) / ops.length) : 0;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prox = [...eventos].filter((e) => new Date(`${e.dataOrdenacao}T00:00:00`) >= hoje).sort((a, b) => a.dataOrdenacao.localeCompare(b.dataOrdenacao))[0];
  const primeiro = (nome || "").trim().split(/\s+/)[0];

  // Série do gráfico: membros ativos no Ecossistema ao longo do período escolhido (dado real).
  const serie = useMemo(() => {
    const n = 9, fim = Date.now(), ini = fim - periodo * 86400000;
    return Array.from({ length: n }, (_, i) => {
      const t = ini + ((fim - ini) * i) / (n - 1);
      return { t, v: crescimento.filter((d) => new Date(d).getTime() <= t).length };
    });
  }, [crescimento, periodo]);
  const maxV = Math.max(10, ...serie.map((p) => p.v));
  const minV = Math.min(...serie.map((p) => p.v));
  const base = Math.max(0, Math.floor((minV - (maxV - minV) * 0.6) / 10) * 10);
  const W = 580, H = 140;
  const xy = serie.map((p, i) => [24 + (i / (serie.length - 1)) * (W - 50), 8 + (1 - (p.v - base) / Math.max(1, maxV - base)) * (H - 22)]);
  const linha = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const fmt = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const atividades: { icone: IconeV; titulo: string; sub: string }[] = [
    ...(ops.length ? [{ icone: "maleta" as IconeV, titulo: "Novas oportunidades encontradas", sub: `${ops.length} conexões para você` }] : []),
    ...ops.filter((x) => x.status === "conversei" || x.status === "fechou").slice(0, 1).map((x) => ({ icone: "aperto" as IconeV, titulo: x.status === "fechou" ? "Negócio fechado" : "Conexão confirmada", sub: x.alvo?.empresa || x.alvo?.nome || "" })),
    ...novos.filter((m) => m.nome !== nome).slice(0, 2).map((m) => ({ icone: "eu" as IconeV, titulo: "Novo membro no ecossistema", sub: m.nome })),
    ...(prox && confirmacoes[prox.id] ? [{ icone: "cal" as IconeV, titulo: "Evento confirmado", sub: prox.titulo }] : []),
  ].slice(0, 4);

  const titulo = (icone: IconeV, t: string, extra?: ReactNode, sub?: string) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
      <span style={{ color: V.verde, marginTop: 1 }}><Ic n={icone} t={20} /></span>
      <div style={{ flex: 1 }}><div style={{ fontSize: 15.5, fontWeight: 800 }}>{t}</div>{sub && <div style={{ fontSize: 12, color: V.suave, marginTop: 2 }}>{sub}</div>}</div>
      {extra}
    </div>
  );

  return (
    <>
      {/* Boas-vindas */}
      <section className="pv-card" style={{ position: "relative", overflow: "hidden", minHeight: 110, padding: "22px 26px", border: 0,
        background: "radial-gradient(120% 140% at 100% 0%, rgba(43,227,107,.22) 0%, rgba(43,227,107,0) 45%), linear-gradient(100deg,#06090A 0%,#0A1410 55%,#0D1F16 100%)" }}>
        <svg viewBox="0 0 600 140" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }} aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${260 + i * 26} 140 L${300 + i * 22} ${30 + (i % 4) * 12} L${330 + i * 22} 140`} fill="none" stroke="#2BE36B" strokeOpacity={0.05 + (i % 3) * 0.03} />)}
          <path d="M470 0 C 520 60, 560 90, 600 100" stroke="#2BE36B" strokeOpacity=".5" fill="none" strokeWidth="1.5" />
        </svg>
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.6, color: "#fff" }}>Olá, {primeiro}! 👋</h1>
            <div style={{ fontSize: 14.5, color: "#DDE6E1", marginTop: 6 }}>Que bom ter você de volta ao Ecossistema Master Business.</div>
            <div style={{ width: 66, height: 3, borderRadius: 3, background: V.verde, marginTop: 14, boxShadow: `0 0 12px ${V.verde}` }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.25, color: "#fff", textAlign: "left" }}>Conexões que<br /><span style={{ color: V.verde }}>transformam negócios</span></div>
        </div>
      </section>

      <div className="pv-kpis">
        <Kpi icone="pessoas" valor={ops.length} rotulo="Conexões Potenciais" serie={[2, 4, 3, 6, 5, 8, 7, 10]} />
        <Kpi icone="aperto" valor={conta("cliente")} rotulo="Clientes Potenciais" serie={[3, 2, 5, 4, 6, 5, 8, 9]} />
        <Kpi icone="grafico" valor={conta("ajuda")} rotulo="Soluções Compatíveis" serie={[1, 3, 2, 4, 6, 5, 7, 9]} />
        <Kpi icone="estrela" valor={conta("parceria")} rotulo="Parcerias Estratégicas" serie={[2, 3, 3, 5, 4, 6, 8, 9]} />
      </div>

      <div className="pv-meio">
        <section className="pv-card" style={{ padding: 18 }}>
          {titulo("grafico", "Crescimento do Ecossistema", (
            <div className="pv-seg">{[[7, "7 dias"], [30, "30 dias"], [90, "90 dias"], [365, "1 ano"]].map(([d, r]) => (
              <button key={d} className={periodo === d ? "on" : ""} onClick={() => setPeriodo(d as number)}>{r}</button>))}</div>
          ))}
          <div className="pv-grafico" style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 14, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setHover(null)}>
                <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={V.verde} stopOpacity=".32" /><stop offset="1" stopColor={V.verde} stopOpacity="0" /></linearGradient></defs>
                {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="24" x2={W - 6} y1={8 + f * (H - 22)} y2={8 + f * (H - 22)} stroke="#1A2620" />)}
                {[0, 0.5, 1].map((f) => <text key={f} x="0" y={12 + f * (H - 22)} fill={V.claro} fontSize="10">{Math.round(maxV - f * (maxV - base))}</text>)}
                <polygon points={`${xy[0][0]},${H - 14} ${linha} ${xy[xy.length - 1][0]},${H - 14}`} fill="url(#area)" />
                <polyline points={linha} fill="none" stroke={V.verde} strokeWidth="2.5" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${V.verde})` }} />
                {xy.map(([x, y], i) => (
                  <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r="12" fill="transparent" />
                    <circle cx={x} cy={y} r={hover === i ? 5.5 : 4} fill={V.verde} stroke="#06090A" strokeWidth="2" />
                  </g>
                ))}
                {[0, 2, 4, 6, 8].map((i) => <text key={i} x={xy[i][0]} y={H + 14} fill={V.claro} fontSize="10.5" textAnchor="middle">{fmt(serie[i].t)}</text>)}
              </svg>
              {(() => { const i = hover ?? 5; const [x, y0] = xy[i]; const y = Math.max(y0, 46); return (
                <div style={{ position: "absolute", left: `${(x / W) * 100}%`, top: `${(y / (H + 20)) * 100}%`, transform: "translate(-50%, -120%)", background: "#0B1210", border: `1px solid ${V.borda2}`, borderRadius: 10, padding: "6px 10px", pointerEvents: "none", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{serie[i].v} membros</div><div style={{ fontSize: 10.5, color: V.suave }}>em {fmt(serie[i].t)}</div>
                </div>); })()}
            </div>
            <div style={{ textAlign: "center" }}>
              <svg width="104" height="104" viewBox="0 0 104 104" style={{ filter: `drop-shadow(0 0 10px ${V.verde}66)` }}>
                <circle cx="52" cy="52" r="42" fill="none" stroke="#14241C" strokeWidth="9" />
                <circle cx="52" cy="52" r="42" fill="none" stroke={V.verde} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(match / 100) * 264} 264`} transform="rotate(-90 52 52)" />
                <text x="52" y="60" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="800">{match}%</text>
              </svg>
              <div style={{ fontSize: 12.5, color: "#DDE6E1", marginTop: 4 }}>Match com<br />seu perfil</div>
            </div>
          </div>
        </section>

        <section className="pv-card" style={{ padding: 18 }}>
          {titulo("raio", "Atividade Recente", <button className="pv-link" onClick={() => onIr("painel")}>Ver todas <Ic n="seta" t={13} /></button>)}
          <div style={{ position: "relative", paddingLeft: 24 }}>
            <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: V.verdeEsc }} />
            {atividades.length === 0 && <div style={{ color: V.suave, fontSize: 13 }}>Sem atividades ainda.</div>}
            {atividades.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "7px 0", position: "relative" }}>
                <span style={{ position: "absolute", left: -24, width: 12, height: 12, borderRadius: "50%", background: V.verde, boxShadow: `0 0 10px ${V.verde}` }} />
                <span style={{ color: "#C9D3CD" }}><Ic n={a.icone} t={20} /></span>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{a.titulo}</div><div style={{ fontSize: 11.5, color: V.suave }}>{a.sub}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="pv-meio">
        <section>
          {titulo("estrela", "Oportunidades Recomendadas", <button className="pv-btn2" onClick={() => onIr("painel")}>Ver todas as oportunidades <Ic n="seta" t={13} /></button>, "Empresas que mais combinam com o seu perfil e objetivos.")}
          <div className="pv-ops">
            {top.length === 0 && <div className="pv-card" style={{ padding: 20, color: V.suave, gridColumn: "1 / -1" }}>Suas oportunidades estão sendo preparadas.</div>}
            {top.map((o) => {
              const a = o.alvo!;
              const img = a.logo_url || a.foto_url;
              return (
                <article key={o.id} className="pv-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {img ? <img src={img} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover", background: "#0B1210" }} />
                      : <span style={{ width: 54, height: 54, borderRadius: 12, background: "linear-gradient(145deg,#173A26,#0C1F15)", border: `1px solid ${V.borda2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: V.verde, flex: "0 0 auto" }}>{(a.empresa || a.nome || "?").charAt(0)}</span>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}><span className="pv-chip"><Ic n="escudo" t={11} />Match {pct(o.forca)}%</span></div>
                      <div style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.empresa || a.nome}</div>
                      <div style={{ fontSize: 11.5, color: V.suave, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.segmento}</div>
                      {(a.cidade || a.estado) && <div style={{ fontSize: 11.5, color: "#C9D3CD", display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}><Ic n="pino" t={12} />{[a.cidade, a.estado].filter(Boolean).join(", ")}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#DDE6E1", minHeight: 36 }}>{o.motivo}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "#C9D3CD", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Ic n="grafico" t={13} />Força: {"●".repeat(o.forca)}{"○".repeat(3 - o.forca)}</span>
                    <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Ic n="tag" t={12} />{ROT[o.tipo]}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                    <button className="pv-btn" style={{ flex: 1 }} onClick={() => abrirWhatsapp(a.telefone_whatsapp)}><Ic n="aperto" t={16} />Conectar</button>
                    <button onClick={() => onIr("painel")} title="Ver detalhes" style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${V.borda2}`, background: "transparent", color: V.texto, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="info" t={18} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section className="pv-card" style={{ padding: 16 }}>
            {titulo("cal", "Próximos Eventos", <button className="pv-link" onClick={() => onIr("agenda")}>Ver calendário <Ic n="seta" t={13} /></button>)}
            {prox ? (() => { const d = new Date(`${prox.dataOrdenacao}T00:00:00`); return (
              <div style={{ display: "flex", gap: 12, alignItems: "center", borderRadius: 12, border: `1px solid ${V.borda2}`, padding: 10, background: "linear-gradient(90deg,#0B1210 0%,#0E1E16 100%)", position: "relative" }}>
                <div style={{ textAlign: "center", minWidth: 52, borderRight: `1px solid ${V.borda2}`, paddingRight: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{String(d.getDate()).padStart(2, "0")}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: V.suave, textTransform: "uppercase", marginTop: 3 }}>{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</div>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {confirmacoes[prox.id] && <span className="pv-chip" style={{ marginBottom: 4 }}><Ic n="check" t={11} />Confirmado</span>}
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{prox.titulo}</div>
                  <div style={{ fontSize: 11.5, color: V.suave }}>Ecossistema Master Business</div>
                  <div style={{ fontSize: 11.5, color: "#C9D3CD", marginTop: 2 }}>{prox.quando}</div>
                </div>

              </div>); })() : <div style={{ color: V.suave, fontSize: 13 }}>Nenhum evento agendado.</div>}
          </section>
          <section className="pv-card pv-glow" style={{ padding: 16, display: "flex", gap: 14, alignItems: "center", background: "radial-gradient(120% 120% at 100% 100%, rgba(43,227,107,.18), rgba(0,0,0,0) 60%), linear-gradient(180deg,#0E1714,#0B1210)" }}>
            <span style={{ color: V.verde, filter: `drop-shadow(0 0 8px ${V.verde})` }}><Ic n="foguete" t={34} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Expanda suas conexões</div>
              <div style={{ fontSize: 11.5, color: V.suave, marginTop: 2 }}>Faça parte de uma rede de negócios com grandes oportunidades.</div>
            </div>
            <button className="pv-btn" style={{ padding: "0 14px", height: 32, fontSize: 12.5 }} onClick={() => onIr("membros")}>Explorar <Ic n="seta" t={13} /></button>
          </section>
        </div>
      </div>
    </>
  );
}
