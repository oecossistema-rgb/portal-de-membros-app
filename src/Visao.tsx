import { useEffect, useMemo, useState } from "react";
import { Sino } from "./Sino";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "./supabase";
import { temaAtual, trocarTema, type Tema } from "./tema";
import { AcaoVaga, CSS_VAGAS, FotosConfirmados, estadoEvento, horario, type AcoesVaga, type VagaInfo } from "./Vagas";

// Novo visual do portal (tema escuro, verde neon), reproduzindo a referência aprovada.
// PortalShell = menu lateral + barra do topo. VisaoGeral = painel inicial do membro.

export const V = {
  fundo: "var(--p-bg)", fundo2: "var(--p-bg)", painel: "var(--p-card)", painel2: "var(--p-card2)", borda: "var(--p-line)", borda2: "var(--p-line2)",
  verde: "var(--p-accent)", verde2: "var(--p-accent-text)", verdeEsc: "var(--p-accent-bg)", texto: "var(--p-text)", suave: "var(--p-muted)", claro: "var(--p-faint)",
};

// Visual estilo Apple: claro ou escuro (tokens em index.css), verde só nos detalhes.
export const CSS_V = `
.pv{ min-height:100vh; background:var(--p-bg); color:var(--p-text); display:grid; grid-template-columns:256px 1fr; text-align:left; line-height:1.4; letter-spacing:-0.01em;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Inter","Segoe UI",system-ui,sans-serif; width:100%; box-sizing:border-box;
  -webkit-font-smoothing:antialiased }
.pv *{ box-sizing:border-box } .pv h1,.pv h2,.pv h3,.pv p{ line-height:1.15 } .pv svg{ flex:0 0 auto }
.pv h1{ font-weight:700 !important; letter-spacing:-0.025em !important }
.pv-side{ background:var(--p-side); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px); border-right:1px solid var(--p-line); padding:20px 14px; display:flex; flex-direction:column; gap:2px; position:sticky; top:0; height:100vh; overflow-y:auto }
.pv-item{ display:flex; align-items:center; gap:12px; padding:9px 12px; border-radius:10px; color:var(--p-text2); font:inherit; font-size:14px; white-space:nowrap; font-weight:500; border:0; background:transparent; cursor:pointer; width:100%; text-align:left; transition:background .15s }
.pv-item svg{ color:var(--p-muted) }
.pv-item:hover{ background:var(--p-hover); color:var(--p-text) }
.pv-item.on{ background:var(--p-accent-bg); color:var(--p-text); font-weight:600 }
.pv-item.on svg{ color:var(--p-accent-text) }
.pv-item.off{ opacity:.4; cursor:default }
.pv-main{ min-width:0; display:flex; flex-direction:column }
.pv-top{ height:60px; display:flex; align-items:center; gap:18px; padding:0 32px; border-bottom:1px solid var(--p-line); background:var(--p-top); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px); position:sticky; top:0; z-index:20 }
.pv-busca{ flex:0 1 460px; margin:0 auto; display:flex; align-items:center; gap:10px; height:36px; border-radius:10px; background:var(--p-hover); border:1px solid transparent; padding:0 12px; color:var(--p-muted); transition:border-color .15s, background .15s }
.pv-busca:focus-within{ border-color:var(--p-accent); background:var(--p-card) }
.pv-busca input{ flex:1; background:transparent; border:0; outline:0; color:var(--p-text); font:inherit; font-size:14px }
.pv-kbd{ font-size:11px; border:1px solid var(--p-line2); border-radius:6px; padding:1px 6px; color:var(--p-muted) }
.pv-conteudo{ padding:32px 36px 48px; display:flex; flex-direction:column; gap:24px; max-width:1400px; width:100%; margin:0 auto }
.pv-card{ background:var(--p-card); border:1px solid var(--p-line); border-radius:20px; box-shadow:var(--p-shadow); transition:box-shadow .2s, transform .2s }
.pv-glow{ border-color:var(--p-line) }
.pv-ops > .pv-card:hover, .op-grid > .pv-card:hover{ box-shadow:var(--p-shadow-hover); transform:translateY(-2px) }
.pv-kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px }
.pv-meio{ display:grid; grid-template-columns:1fr 330px; gap:20px }
.pv-destaque{ position:relative; overflow:hidden; padding:28px 30px; display:flex; flex-direction:column; justify-content:center; border:1px solid color-mix(in srgb, var(--p-accent) 35%, var(--p-line)) !important;
  background: radial-gradient(90% 140% at 100% 0%, color-mix(in srgb, var(--p-accent) 26%, transparent) 0%, transparent 55%), linear-gradient(135deg, var(--p-card) 0%, var(--p-card) 55%, var(--p-accent-bg) 100%) !important;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 18px 40px -18px color-mix(in srgb, var(--p-accent) 45%, transparent) }
.pv-destaque-fundo{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none }
.pv-destaque-corpo{ position:relative; display:flex; gap:24px; align-items:center; flex-wrap:wrap }
.pv-destaque-olho{ font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--p-accent-text) }
.pv-destaque-cta{ height:44px; padding:0 20px; font-size:15px; box-shadow:0 8px 20px -8px var(--p-accent) }
.pv-destaque-ok{ display:inline-flex; align-items:center; gap:8px; height:44px; padding:0 18px; border-radius:12px; background:var(--p-accent-bg); color:var(--p-accent-text); font-weight:650; font-size:14.5px }
.pv-destaque-data{ flex:0 0 auto; width:150px; text-align:center; padding:18px 10px 16px; border-radius:22px; background:var(--p-card);
  border:1px solid var(--p-line); box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 12px 28px -14px rgba(0,0,0,.35) }
.pv-destaque-dia{ font-size:54px; font-weight:800; line-height:1; letter-spacing:-2px; color:var(--p-text) }
.pv-destaque-mes{ font-size:14px; font-weight:700; letter-spacing:.2em; color:var(--p-accent-text); margin-top:4px }
.pv-destaque-falta{ margin-top:12px; font-size:13px; color:var(--p-text2); padding-top:10px; border-top:1px solid var(--p-line) }
.pv-destaque-falta strong{ color:var(--p-text); font-size:15px }
@media (max-width:640px){ .pv-destaque{ padding:22px 20px } .pv-destaque-data{ width:100%; display:flex; align-items:baseline; justify-content:center; gap:10px; padding:12px } .pv-destaque-dia{ font-size:36px } .pv-destaque-falta{ margin:0; padding:0; border:0 } }
.pv-ops{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px }
.pv-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; height:36px; padding:0 18px; border-radius:980px; border:0; background:var(--p-accent); color:var(--p-on-accent); font:inherit; font-weight:600; font-size:14px; cursor:pointer; transition:filter .15s, transform .1s }
.pv-btn:hover{ filter:brightness(1.08) } .pv-btn:active{ transform:scale(.98) }
.pv-btn2{ display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 14px; border-radius:980px; border:1px solid var(--p-line2); background:var(--p-card); color:var(--p-text); font:inherit; font-size:13px; font-weight:500; cursor:pointer }
.pv-btn2:hover{ background:var(--p-hover) }
.pv-link{ color:var(--p-accent-text); font-size:13px; font-weight:600; background:none; border:0; cursor:pointer; font-family:inherit; display:inline-flex; gap:4px; align-items:center }
.pv-seg{ display:flex; gap:2px; background:var(--p-hover); border:0; border-radius:10px; padding:3px }
.pv-seg button{ border:0; background:transparent; color:var(--p-text2); font:inherit; font-size:12.5px; font-weight:500; padding:6px 14px; border-radius:8px; cursor:pointer; white-space:nowrap }
.pv-seg button.on{ background:var(--p-card); color:var(--p-text); font-weight:600; box-shadow:0 1px 3px rgba(0,0,0,.12), 0 0 0 .5px rgba(0,0,0,.04) }
.pv-chip{ display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:var(--p-accent-text); background:var(--p-accent-bg); border:0; border-radius:980px; padding:3px 9px }
.pv-logo-led{ display:block; border-radius:50%; box-shadow:0 0 0 1.5px #3BA7FF, 0 0 10px 2px rgba(59,167,255,.75), 0 0 26px 6px rgba(59,167,255,.32); animation:pv-led 3.2s ease-in-out infinite }
@keyframes pv-led{ 0%,100%{ box-shadow:0 0 0 1.5px #3BA7FF, 0 0 10px 2px rgba(59,167,255,.75), 0 0 26px 6px rgba(59,167,255,.32) } 50%{ box-shadow:0 0 0 1.5px #6CC0FF, 0 0 14px 3px rgba(59,167,255,.95), 0 0 34px 10px rgba(59,167,255,.45) } }
@media (prefers-reduced-motion: reduce){ .pv-logo-led{ animation:none } }
.pv-marca{ display:inline-block; text-transform:uppercase; color:var(--p-text) }
.pv-marca1{ font-size:12.5px; font-weight:600; letter-spacing:.42em; margin-right:-.42em; line-height:1.3 }
.pv-marca2{ font-size:17px; font-weight:700; letter-spacing:.04em; line-height:1.15 }
.pv-tema{ width:36px; height:36px; border-radius:50%; border:1px solid var(--p-line2); background:var(--p-card); color:var(--p-text); display:inline-flex; align-items:center; justify-content:center; cursor:pointer }
.pv-tema:hover{ background:var(--p-hover) }
@media (max-width:1180px){ .pv-meio{ grid-template-columns:1fr } .pv-ops{ grid-template-columns:repeat(2,1fr) } }
@media (max-width:900px){
  .pv{ grid-template-columns:1fr } .pv-side{ position:static; height:auto; flex-direction:row; overflow-x:auto; padding:10px }
  .pv-side > div:not(.pv-logo):not(.pv-promo){ display:contents !important } .pv-side .pv-logo, .pv-side .pv-promo, .pv-kbd{ display:none !important } .pv-side{ flex-wrap:nowrap; gap:4px } .pv-grafico{ grid-template-columns:1fr !important }
  .pv-side .pv-logo, .pv-side .pv-promo{ display:none } .pv-item{ width:auto; white-space:nowrap }
  /* Menu do celular: no topo, em destaque (botões visíveis, aba atual em verde cheio). */
  .pv-side{ gap:8px !important; padding:12px 14px !important; border-right:0; border-bottom:1px solid var(--p-line); background:var(--p-card); box-shadow:0 6px 18px -14px rgba(0,0,0,.35); scrollbar-width:none;
    -webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 28px),transparent 100%); mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 28px),transparent 100%) }
  .pv-side::-webkit-scrollbar{ display:none }
  .pv-side::after{ content:""; flex:0 0 24px }
  .pv-side .pv-item{ flex:0 0 auto; padding:10px 16px; border-radius:980px; border:1px solid var(--p-line2); background:var(--p-bg); color:var(--p-text); font-size:14.5px; font-weight:600 }
  .pv-side .pv-item svg{ color:var(--p-accent-text) }
  .pv-side .pv-item.on{ background:var(--p-accent); border-color:var(--p-accent); color:var(--p-on-accent); box-shadow:0 6px 16px -8px var(--p-accent) }
  .pv-side .pv-item.on svg{ color:var(--p-on-accent) }
  .pv-side .pv-item.off{ display:none }
  .pv-kpis{ grid-template-columns:repeat(2,1fr) } .pv-ops{ grid-template-columns:1fr } .pv-top{ padding:0 14px } .pv-conteudo{ padding:18px 14px 28px }
  .pv-quem-txt{ display:none !important }
  .pv-busca{ min-width:0; flex:1 1 auto } .pv-busca input{ min-width:0; width:100% } .pv-kbd{ display:none !important } .pv-top{ gap:10px } .pv-seg{ max-width:100%; overflow-x:auto } .pv-meio > *, .pv > * { min-width:0 }
}`;

export type IconeV = "casa" | "aperto" | "pessoas" | "rede" | "cal" | "dados" | "ferramenta" | "eu" | "engrenagem" | "ajuda" | "sino" | "busca" | "grafico" | "raio" | "estrela" | "pino" | "maleta" | "info" | "foguete" | "seta" | "check" | "escudo" | "play" | "seta-baixo" | "tag" | "sair" | "sol" | "lua" | "olho";
export function Ic({ n, t = 18 }: { n: IconeV; t?: number }) {
  const p: Record<IconeV, ReactNode> = {
    casa: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
    aperto: <><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" /></>,
    pessoas: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14.2c2.9.3 5 2.6 5 5.8" /></>,
    rede: <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="7" r="2.4" /><circle cx="9" cy="18" r="2.4" /><circle cx="18" cy="17" r="2" /><path d="M8 7.5l1 8M8.2 5.6l7.4.9M11.3 17.6l4.7-.4M17.8 9.4l.1 5.6" /></>,
    cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    dados: <><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="4" rx="1.5" /><rect x="13" y="10" width="8" height="10" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /></>,
    ferramenta: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="16" r="3" /><path d="M10.5 10.5l3 3M14 5h5v5M5 14v5h5" /></>,
    eu: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
    olho: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
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
    sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    lua: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
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
      <path d="M16 6 L22 24 L30 30 Z" fill="var(--p-accent-bg)" opacity=".55" />
      <path d="M44 6 L38 24 L30 30 Z" fill="var(--p-accent-bg)" opacity=".55" />
    </svg>
  );
}

// Foto ou logo; se a imagem não carregar (link quebrado), mostra a inicial no lugar.
export function Avatar({ src, nome, tam = 54, raio = 12 }: { src?: string | null; nome: string; tam?: number; raio?: number | string }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => { setFalhou(false); }, [src]);
  const base: CSSProperties = { width: tam, height: tam, borderRadius: raio, flex: "0 0 auto" };
  if (src && !falhou) return <img src={src} alt="" loading="lazy" onError={() => setFalhou(true)} style={{ ...base, objectFit: "cover", background: "var(--p-card2)", border: "1px solid var(--p-line)" }} />;
  return <span style={{ ...base, background: "var(--p-accent-bg)", color: "var(--p-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(tam * 0.4), fontWeight: 600 }}>{(nome || "?").trim().charAt(0).toUpperCase()}</span>;
}

export type ItemMenu = { id: string; titulo: string; icone: IconeV; badge?: number; pronto?: boolean };

export function PortalShell({ itens, ativo, onIr, nome, papel, foto, onSair, busca, onBusca, children }: {
  itens: ItemMenu[][]; ativo: string; onIr: (id: string) => void; nome: string; papel: string; foto?: string | null;
  onSair: () => void; busca?: string; onBusca?: (t: string) => void; children: ReactNode;
}) {
  const [menuUser, setMenuUser] = useState(false);
  const [tema, setTema] = useState<Tema>(() => temaAtual());
  // No celular o menu corre para o lado: mantém a aba atual sempre à vista.
  useEffect(() => {
    if (window.innerWidth > 900) return;
    document.querySelector(".pv-side .pv-item.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [ativo]);
  return (
    <div className="pv">
      <style>{CSS_V}</style>
      <aside className="pv-side">
        <div className="pv-logo" style={{ textAlign: "center", padding: "6px 4px 18px" }}>
          <img src="/logo-ecossistema-redondo.png" alt="Ecossistema Master Business" className="pv-logo-led" style={{ width: 60, height: 60, margin: "4px auto 12px" }} />
          <div className="pv-marca"><div className="pv-marca1">Ecossistema</div><div className="pv-marca2">Master Business</div></div>
          <div style={{ fontSize: 9, color: V.suave, marginTop: 5 }}>Conectando Negócios • Multiplicando Resultados</div>
        </div>
        {itens.map((grupo, gi) => (
          <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: gi ? 14 : 0 }}>
            {grupo.map((it) => (
              <button key={it.id} className={`pv-item${ativo === it.id ? " on" : ""}${it.pronto === false ? " off" : ""}`}
                onClick={() => it.pronto !== false && onIr(it.id)} title={it.pronto === false ? "Em breve" : undefined}>
                <Ic n={it.icone} />
                <span style={{ flex: 1 }}>{it.titulo}</span>
                {!!it.badge && <span style={{ background: V.verde, color: "var(--p-on-accent)", borderRadius: 100, fontSize: 10.5, fontWeight: 700, padding: "1px 7px" }}>{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="pv-promo pv-card pv-glow" style={{ marginTop: "auto", padding: "16px 12px", textAlign: "center" }}>
          <svg width="56" height="34" viewBox="0 0 56 34" aria-hidden="true"><path d="M2 30 L18 18 L28 24 L50 4" fill="none" stroke={V.verde} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M40 4 H50 V14" fill="none" stroke={V.verde} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ fontWeight: 700, fontSize: 14, margin: "6px 0 4px", lineHeight: 1.2 }}>Juntos somos<br />mais fortes!</div>
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
          <button className="pv-tema" title={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"} aria-label="Trocar tema claro/escuro" onClick={() => setTema(trocarTema())}><Ic n={tema === "escuro" ? "sol" : "lua"} t={17} /></button>
          <Sino onIr={onIr} cor={V.texto} />
          <div className="pv-quem" style={{ position: "relative" }}>
            <button onClick={() => setMenuUser(!menuUser)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: 0, color: V.texto, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              {foto ? <img src={foto} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${V.borda2}` }} />
                : <span style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--p-accent-bg)", color: "var(--p-accent-text)", border: `2px solid ${V.borda2}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{(nome || "?").charAt(0)}</span>}
              <span className="pv-quem-txt" style={{ textAlign: "left" }}><span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{nome}</span><span style={{ display: "block", fontSize: 11.5, color: V.suave }}>{papel}</span></span>
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
export type EventoV = { id: string; titulo: string; quando: string; dataOrdenacao: string; trilha: string; diaSemana?: string; local?: string | null; inscrivel?: boolean; vaga?: VagaInfo; horaInicio?: string | null; horaFim?: string | null };

const ROT: Record<TipoOp, string> = { cliente: "Cliente potencial", ajuda: "Solução para você", parceria: "Parceria", afinidade: "Afinidade" };
const pct = (f: number) => (f >= 3 ? 95 : f === 2 ? 82 : 64);

function Kpi({ icone, valor, rotulo, serie }: { icone: IconeV; valor: number; rotulo: string; serie: number[] }) {
  const max = Math.max(1, ...serie);
  const pts = serie.map((v, i) => `${(i / Math.max(1, serie.length - 1)) * 100},${34 - (v / max) * 30}`).join(" ");
  return (
    <div className="pv-card pv-glow" style={{ padding: "16px 16px 14px", display: "flex", alignItems: "center", gap: 14, position: "relative", overflow: "hidden", minHeight: 76 }}>
      <span style={{ width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,var(--p-line),var(--p-accent-bg))", border: "1px solid var(--p-line)", color: V.verde, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px -6px ${V.verde}` }}><Ic n={icone} t={22} /></span>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: -0.5 }}>{valor}</div>
        <div style={{ fontSize: 12, color: "var(--p-text2)", marginTop: 6 }}>{rotulo}</div>
      </div>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ position: "absolute", right: 12, top: 14, width: 74, height: 30 }} aria-hidden="true">
        <defs><linearGradient id={`k${rotulo.length}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={V.verde} stopOpacity=".35" /><stop offset="1" stopColor={V.verde} stopOpacity="0" /></linearGradient></defs>
        <polygon points={`0,36 ${pts} 100,36`} fill={`url(#k${rotulo.length})`} />
        <polyline points={pts} fill="none" stroke={V.verde} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Próximo encontro em destaque na tela inicial (no lugar do gráfico de crescimento), com cara de campanha.
const TRILHA_ROT: Record<string, string> = { imersao: "Imersão", growth: "Growth Session", conselho: "Reunião de Conselho", "business-day": "Business Day", network: "Network Experience", "network-experience": "Network Experience" };
function EventoDestaque({ evento, confirmado, acoes, onIr }: { evento?: EventoV; confirmado: boolean; acoes: AcoesVaga; onIr: (id: string) => void }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (!evento) return (
    <section className="pv-card pv-destaque" style={{ padding: 26 }}>
      <div className="pv-destaque-olho">Próximo encontro</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>Novos encontros em breve</div>
      <div style={{ fontSize: 14, color: "var(--p-text2)", marginTop: 6 }}>Assim que a agenda for publicada, ele aparece aqui.</div>
    </section>
  );
  const d = new Date(`${evento.dataOrdenacao}T00:00:00`);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  const quando = dias <= 0 ? "É hoje!" : dias === 1 ? "É amanhã!" : null;
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit" });
  const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
  return (
    <section className="pv-card pv-destaque">
      <style>{CSS_VAGAS}</style>
      <svg className="pv-destaque-fundo" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${200 + i * 28} 260 L${250 + i * 24} ${40 + (i % 5) * 14} L${282 + i * 24} 260`} fill="none" stroke="var(--p-accent)" strokeOpacity={0.05 + (i % 3) * 0.035} />)}
      </svg>
      <div className="pv-destaque-corpo">
        <div style={{ minWidth: 0, flex: "1 1 300px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="pv-destaque-olho">Próximo encontro</span>
            {TRILHA_ROT[evento.trilha] && <span className="pv-chip">{TRILHA_ROT[evento.trilha]}</span>}
          </div>
          <h2 style={{ margin: "10px 0 0", fontSize: 30, lineHeight: 1.1, fontWeight: 750, letterSpacing: -0.6, color: "var(--p-text)" }}>{evento.titulo}</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 14.5, color: "var(--p-text2)" }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Ic n="cal" t={16} />{[evento.diaSemana, evento.quando, horario(evento)].filter(Boolean).join(" · ")}</span>
            {evento.local && <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Ic n="pino" t={16} />{evento.local}</span>}
          </div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <AcaoVaga e={evento} estado={estadoEvento(evento, confirmado)} acoes={acoes} grande botao="pv-btn pv-destaque-cta" botao2="pv-btn2" />
            <FotosConfirmados v={evento.vaga} max={6} />
            <div><button className="pv-btn2" onClick={() => onIr("agenda")}>Ver agenda completa</button></div>
          </div>
        </div>
        <div className="pv-destaque-data">
          <div className="pv-destaque-dia">{dia}</div>
          <div className="pv-destaque-mes">{mes}</div>
          <div className="pv-destaque-falta">{quando || <>faltam <strong>{dias}</strong> dias</>}</div>
        </div>
      </div>
    </section>
  );
}

function abrirWhatsapp(n?: string | null) {
  const t = (n || "").replace(/\D/g, "");
  if (t) window.open(`https://wa.me/${t.startsWith("55") ? t : `55${t}`}`, "_blank", "noopener");
}

export function VisaoGeral({ userId, membroId, nome, eventos, confirmacoes, onIr, acoes, demo }: {
  userId: string; membroId?: string; nome: string; eventos: EventoV[]; confirmacoes: Record<string, string>; onIr: (id: string) => void;
  acoes?: AcoesVaga; // sem isso (ex.: "ver como membro"), os botões ficam só para olhar
  demo?: { ops: Op[]; membros: { nome: string; created_at: string }[] }; // só para pré-visualização
}) {
  const [ops, setOps] = useState<Op[]>([]);
  const [novos, setNovos] = useState<{ nome: string; created_at: string }[]>([]);

  useEffect(() => {
    if (demo) {
      setOps(demo.ops); setNovos(demo.membros.slice(0, 2)); return;
    }
    (async () => {
      const { data: eu } = membroId ? { data: { id: membroId } } : await supabase.from("membros").select("id").eq("auth_user_id", userId).maybeSingle();
      const [{ data: o }, { data: ms }] = await Promise.all([
        eu ? supabase.from("membros_oportunidades")
          .select("id,tipo,motivo,forca,status,gerado_em,atualizado_em,alvo:membros!membros_oportunidades_alvo_id_fkey(nome,empresa,segmento,cidade,estado,foto_url,logo_url,telefone_whatsapp)")
          .eq("membro_id", eu.id) : Promise.resolve({ data: [] }),
        supabase.from("membros").select("nome,created_at").eq("ativo", true).eq("equipe", false).order("created_at", { ascending: false }),
      ]);
      setOps(((o as unknown as Op[]) || []).filter((x) => x.alvo && x.status !== "descartada"));
      const lista = (ms as { nome: string; created_at: string }[]) || [];
      setNovos(lista.slice(0, 3));
    })();
  }, [userId, membroId]);

  const conta = (t: TipoOp) => ops.filter((x) => x.tipo === t).length;
  const top = useMemo(() => [...ops].sort((a, b) => b.forca - a.forca).slice(0, 3), [ops]);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prox = [...eventos].filter((e) => new Date(`${e.dataOrdenacao}T00:00:00`) >= hoje).sort((a, b) => a.dataOrdenacao.localeCompare(b.dataOrdenacao))[0];
  const primeiro = (nome || "").trim().split(/\s+/)[0];

  const atividades: { icone: IconeV; titulo: string; sub: string }[] = [
    ...(ops.length ? [{ icone: "maleta" as IconeV, titulo: "Novas oportunidades encontradas", sub: `${ops.length} conexões para você` }] : []),
    ...ops.filter((x) => x.status === "conversei" || x.status === "fechou").slice(0, 1).map((x) => ({ icone: "aperto" as IconeV, titulo: x.status === "fechou" ? "Negócio fechado" : "Conexão confirmada", sub: x.alvo?.empresa || x.alvo?.nome || "" })),
    ...novos.filter((m) => m.nome !== nome).slice(0, 2).map((m) => ({ icone: "eu" as IconeV, titulo: "Novo membro no ecossistema", sub: m.nome })),
    ...(prox && confirmacoes[prox.id] ? [{ icone: "cal" as IconeV, titulo: "Evento confirmado", sub: prox.titulo }] : []),
  ].slice(0, 4);

  const titulo = (icone: IconeV, t: string, extra?: ReactNode, sub?: string) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
      <span style={{ color: V.verde, marginTop: 1 }}><Ic n={icone} t={20} /></span>
      <div style={{ flex: 1 }}><div style={{ fontSize: 15.5, fontWeight: 700 }}>{t}</div>{sub && <div style={{ fontSize: 12, color: V.suave, marginTop: 2 }}>{sub}</div>}</div>
      {extra}
    </div>
  );

  return (
    <>
      {/* Boas-vindas */}
      <section className="pv-card" style={{ position: "relative", overflow: "hidden", minHeight: 110, padding: "22px 26px", border: 0,
        background: "radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--p-accent) 22%, transparent) 0%, color-mix(in srgb, var(--p-accent) 0%, transparent) 45%), linear-gradient(100deg,var(--p-bg) 0%,var(--p-card) 55%,var(--p-accent-bg) 100%)" }}>
        <svg viewBox="0 0 600 140" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }} aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${260 + i * 26} 140 L${300 + i * 22} ${30 + (i % 4) * 12} L${330 + i * 22} 140`} fill="none" stroke="var(--p-accent)" strokeOpacity={0.05 + (i % 3) * 0.03} />)}
          <path d="M470 0 C 520 60, 560 90, 600 100" stroke="var(--p-accent)" strokeOpacity=".5" fill="none" strokeWidth="1.5" />
        </svg>
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: -0.6, color: "var(--p-text)" }}>Olá, {primeiro}! 👋</h1>
            <div style={{ fontSize: 14.5, color: "var(--p-text)", marginTop: 6 }}>Que bom ter você de volta ao Ecossistema Master Business.</div>
            <div style={{ width: 66, height: 3, borderRadius: 3, background: V.verde, marginTop: 14, boxShadow: `0 0 12px ${V.verde}` }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: "var(--p-text)", textAlign: "left" }}>Conexões que<br /><span style={{ color: V.verde }}>transformam negócios</span></div>
        </div>
      </section>

      <div className="pv-kpis">
        <Kpi icone="pessoas" valor={ops.length} rotulo="Conexões Potenciais" serie={[2, 4, 3, 6, 5, 8, 7, 10]} />
        <Kpi icone="aperto" valor={conta("cliente")} rotulo="Clientes Potenciais" serie={[3, 2, 5, 4, 6, 5, 8, 9]} />
        <Kpi icone="grafico" valor={conta("ajuda")} rotulo="Soluções Compatíveis" serie={[1, 3, 2, 4, 6, 5, 7, 9]} />
        <Kpi icone="estrela" valor={conta("parceria")} rotulo="Parcerias Estratégicas" serie={[2, 3, 3, 5, 4, 6, 8, 9]} />
      </div>

      <div className="pv-meio">
        <EventoDestaque evento={prox} confirmado={!!(prox && confirmacoes[prox.id])} acoes={acoes || {}} onIr={onIr} />

        <section className="pv-card" style={{ padding: 18 }}>
          {titulo("raio", "Atividade Recente", <button className="pv-link" onClick={() => onIr("painel")}>Ver todas <Ic n="seta" t={13} /></button>)}
          <div style={{ position: "relative", paddingLeft: 24 }}>
            <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: V.verdeEsc }} />
            {atividades.length === 0 && <div style={{ color: V.suave, fontSize: 13 }}>Sem atividades ainda.</div>}
            {atividades.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "7px 0", position: "relative" }}>
                <span style={{ position: "absolute", left: -24, width: 12, height: 12, borderRadius: "50%", background: V.verde, boxShadow: `0 0 10px ${V.verde}` }} />
                <span style={{ color: "var(--p-text2)" }}><Ic n={a.icone} t={20} /></span>
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
                    <Avatar src={img} nome={a.empresa || a.nome || "?"} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}><span className="pv-chip"><Ic n="escudo" t={11} />Match {pct(o.forca)}%</span></div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.empresa || a.nome}</div>
                      <div style={{ fontSize: 11.5, color: V.suave, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.segmento}</div>
                      {(a.cidade || a.estado) && <div style={{ fontSize: 11.5, color: "var(--p-text2)", display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}><Ic n="pino" t={12} />{[a.cidade, a.estado].filter(Boolean).join(", ")}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--p-text)", minHeight: 36 }}>{o.motivo}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--p-text2)", flexWrap: "wrap" }}>
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
              <div style={{ display: "flex", gap: 12, alignItems: "center", borderRadius: 12, border: `1px solid ${V.borda2}`, padding: 10, background: "var(--p-card2)", position: "relative" }}>
                <div style={{ textAlign: "center", minWidth: 52, borderRight: `1px solid ${V.borda2}`, paddingRight: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{String(d.getDate()).padStart(2, "0")}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: V.suave, textTransform: "uppercase", marginTop: 3 }}>{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</div>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {confirmacoes[prox.id] && <span className="pv-chip" style={{ marginBottom: 4 }}><Ic n="check" t={11} />Confirmado</span>}
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{prox.titulo}</div>
                  <div style={{ fontSize: 11.5, color: V.suave }}>Ecossistema Master Business</div>
                  <div style={{ fontSize: 11.5, color: "var(--p-text2)", marginTop: 2 }}>{prox.quando}</div>
                </div>

              </div>); })() : <div style={{ color: V.suave, fontSize: 13 }}>Nenhum evento agendado.</div>}
          </section>
          <section className="pv-card pv-glow" style={{ padding: 16, display: "flex", gap: 14, alignItems: "center", background: "radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--p-accent) 18%, transparent), rgba(0,0,0,0) 60%), linear-gradient(180deg,var(--p-card),var(--p-card))" }}>
            <span style={{ color: V.verde, filter: `drop-shadow(0 0 8px ${V.verde})` }}><Ic n="foguete" t={34} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Expanda suas conexões</div>
              <div style={{ fontSize: 11.5, color: V.suave, marginTop: 2 }}>Faça parte de uma rede de negócios com grandes oportunidades.</div>
            </div>
            <button className="pv-btn" style={{ padding: "0 14px", height: 32, fontSize: 12.5 }} onClick={() => onIr("membros")}>Explorar <Ic n="seta" t={13} /></button>
          </section>
        </div>
      </div>
    </>
  );
}
