import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// Agenda de Eventos: visual minimalista, agrupado por mês, com bloco de data e destaque do próximo encontro.
// Galeria de fotos e vídeos do evento: pastas do Google Drive compartilhadas por link (nada fica nos nossos servidores).
export type Galeria = { pasta?: string; dias: { titulo: string; pastas: { nome: string; id: string }[] }[] };
export type EventoAgenda = { id: string; trilha: string; titulo: string; quando: string; diaSemana: string; dataOrdenacao: string; inscrivel?: boolean; local?: string | null; galeria?: Galeria | null };

const TIPOS: Record<string, { rotulo: string; plural: string; cor: string }> = {
  imersao: { rotulo: "Imersão", plural: "Imersões", cor: "#8BAD3F" },
  "business-day": { rotulo: "Business Day", plural: "Business Day", cor: "var(--p-text)" },
  growth: { rotulo: "Growth Session", plural: "Growth Sessions", cor: "#B8C98A" },
  conselho: { rotulo: "Conselho", plural: "Conselho", cor: "#5B6577" },
};
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const C = { tinta: "var(--p-text)", texto: "var(--p-text2)", suave: "var(--p-muted)", claro: "var(--p-faint)", oliva: "var(--p-accent)", olivaEsc: "var(--p-accent)", olivaClaro: "color-mix(in srgb, var(--p-accent) 10%, transparent)", borda: "var(--p-line)", fundo: "var(--p-field)", tinta2: "var(--p-hover)" };

const CSS = `
.ag{ text-align:left }
.ag-hero{ background:radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--p-accent) 20%, transparent) 0%, color-mix(in srgb, var(--p-accent) 0%, transparent) 45%), linear-gradient(100deg,var(--p-bg) 0%,var(--p-card) 55%,var(--p-accent-bg) 100%); color:var(--p-text); border-radius:14px; border:1px solid var(--p-line) }
.ag-hero-in{ padding:26px 26px 24px; display:flex; gap:24px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap }
.ag-prox{ background:var(--p-card); border:1px solid var(--p-line); border-radius:16px; padding:16px 18px; min-width:260px; box-shadow:inset 0 1px 0 rgba(255,255,255,.05) }
.ag-barra{ background:linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%); border-bottom:1px solid ${C.borda}; position:sticky; top:60px; z-index:5; border:0; background:var(--p-bg); margin-top:8px }
.ag-barra-in{ padding:10px 0; display:flex; gap:6px; overflow-x:auto }
.ag-filtro{ border:1px solid transparent; background:transparent; border-radius:100px; padding:8px 14px; font:inherit; font-size:14px; font-weight:700; color:${C.texto}; cursor:pointer; white-space:nowrap; display:flex; gap:7px; align-items:center }
.ag-filtro:hover{ background:${C.fundo} }
.ag-filtro.on{ background:var(--p-accent); color:var(--p-on-accent) }
.ag-lista{ padding:16px 0 24px }
.ag-mes{ display:flex; align-items:center; gap:12px; margin:26px 0 12px; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:${C.suave} }
.ag-mes:first-child{ margin-top:0 }
.ag-mes::after{ content:""; flex:1; height:1px; background:${C.borda} }
.ag-ev{ display:grid; grid-template-columns:76px 1fr auto; gap:18px; align-items:center; background:linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%); border:1px solid ${C.borda}; border-radius:20px; box-shadow:var(--p-shadow); padding:14px 18px 14px 14px; margin-bottom:10px; transition:box-shadow .18s ease, transform .18s ease, border-color .18s ease }
.ag-ev:hover{ box-shadow:0 12px 28px -16px rgba(26,31,43,.28); transform:translateY(-1px) }
.ag-ev.prox{ border-color:${C.oliva}; box-shadow:0 0 0 3px var(--p-accent-bg) }
.ag-ev.passado .ag-data{ opacity:.7 }
.ag-secao{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin:34px 0 4px }
.ag-secao h2{ margin:0; font-size:22px; font-weight:700; letter-spacing:-0.02em; color:var(--p-text) }
.ag-btn2{ display:inline-flex; align-items:center; gap:8px; text-decoration:none; border:1px solid var(--p-line2); background:var(--p-card); color:var(--p-text); border-radius:980px; padding:9px 16px; font:inherit; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap }
.ag-btn2:hover{ background:var(--p-hover) }
.gal-fundo{ position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px }
.gal{ background:var(--p-card); color:var(--p-text); border:1px solid var(--p-line); border-radius:22px; width:min(1180px,100%); height:min(860px,100%); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.35) }
.gal-topo{ padding:18px 22px 12px; border-bottom:1px solid var(--p-line); display:flex; flex-direction:column; gap:12px }
.gal-x{ border:0; background:var(--p-hover); color:var(--p-text); width:34px; height:34px; border-radius:50%; font-size:18px; cursor:pointer; flex:0 0 auto }
.gal-chips{ display:flex; gap:6px; flex-wrap:wrap }
.gal-chip{ border:1px solid var(--p-line2); background:transparent; color:var(--p-text2); border-radius:980px; padding:6px 14px; font:inherit; font-size:13px; font-weight:500; cursor:pointer }
.gal-chip.on{ background:var(--p-accent); border-color:var(--p-accent); color:var(--p-on-accent); font-weight:600 }
.gal-corpo{ flex:1; min-height:0; background:#fff }
.gal-corpo iframe{ width:100%; height:100%; border:0; display:block }
@media (max-width:640px){ .gal-fundo{ padding:0 } .gal{ border-radius:0; height:100% } }
.ag-data{ border-radius:12px; background:${C.fundo}; text-align:center; padding:9px 0 8px }
.ag-btn{ border:0; background:linear-gradient(180deg,var(--p-accent) 0%,var(--p-accent) 100%); color:var(--p-on-accent); border-radius:980px; padding:10px 18px; font:inherit; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap }
.ag-btn:hover{ filter:brightness(1.06) }
.ag-ok{ display:flex; align-items:center; gap:10px; border:1px solid var(--p-line); background:${C.olivaClaro}; color:${C.olivaEsc}; border-radius:10px; padding:8px 12px; font:inherit; cursor:pointer; text-align:left }
.ag-ok:hover .ag-ok-sub{ text-decoration:underline }
@media (max-width:640px){
  .ag-ev{ grid-template-columns:62px 1fr; gap:12px }
  .ag-acao{ grid-column:1 / -1 }
  .ag-acao > *{ width:100%; justify-content:center }
  .ag-hero-in{ padding:26px 16px 22px }
  .ag-lista, .ag-barra-in{ padding-left:16px; padding-right:16px }
}`;

function dataDe(e: EventoAgenda): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(e.dataOrdenacao || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
const hoje0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function Ponto({ cor }: { cor: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor, display: "inline-block", flex: "0 0 auto" }} />;
}

export function Agenda({ eventos, carregando, filtro, setFiltro, confirmacoes, onConfirmar, onCancelar }: {
  eventos: EventoAgenda[]; carregando: boolean; filtro: string; setFiltro: (f: string) => void;
  confirmacoes: Record<string, string>; onConfirmar: (e: EventoAgenda) => void; onCancelar: (e: EventoAgenda) => void;
}) {
  const hoje = hoje0();
  const ordenados = useMemo(() => [...eventos].sort((a, b) => (a.dataOrdenacao || "").localeCompare(b.dataOrdenacao || "")), [eventos]);
  const proximo = ordenados.find((e) => { const d = dataDe(e); return d && d >= hoje; });
  const [galeriaDe, setGaleriaDe] = useState<EventoAgenda | null>(null);
  const doFiltro = filtro === "todos" ? ordenados : ordenados.filter((e) => e.trilha === filtro);
  // Encontros já realizados ficam sempre visíveis, numa seção própria, do mais recente para o mais antigo.
  const realizados = doFiltro.filter((e) => { const d = dataDe(e); return d && d < hoje; }).reverse();
  const visiveis = doFiltro.filter((e) => { const d = dataDe(e); return !d || d >= hoje; });
  const conta = (t: string) => ordenados.filter((e) => e.trilha === t).length;
  const confirmados = Object.keys(confirmacoes).filter((id) => ordenados.some((e) => e.id === id)).length;

  const grupos: { chave: string; titulo: string; itens: EventoAgenda[] }[] = [];
  for (const e of visiveis) {
    const d = dataDe(e);
    const chave = d ? `${d.getFullYear()}-${d.getMonth()}` : "sem-data";
    const titulo = d ? `${MESES[d.getMonth()]} ${d.getFullYear()}` : "Sem data";
    const g = grupos.find((x) => x.chave === chave);
    if (g) g.itens.push(e); else grupos.push({ chave, titulo, itens: [e] });
  }

  const diasAte = (e: EventoAgenda) => { const d = dataDe(e); return d ? Math.round((d.getTime() - hoje.getTime()) / 86400000) : null; };
  const quandoTexto = (n: number | null) => n === null ? "" : n === 0 ? "é hoje" : n === 1 ? "é amanhã" : `em ${n} dias`;

  const acao = (e: EventoAgenda): ReactNode => {
    const conf = confirmacoes[e.id];
    const d = dataDe(e);
    if (d && d < hoje) return e.galeria?.dias?.length
      ? <button className="ag-btn" onClick={() => setGaleriaDe(e)}>📷 Fotos e vídeos</button>
      : <span style={{ fontSize: 13, fontWeight: 600, color: C.claro }}>Realizado</span>;
    if (conf) return (
      <button className="ag-ok" onClick={() => onCancelar(e)} title="Clique para cancelar sua presença">
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: C.oliva, color: "var(--p-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>✓</span>
        <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Presença confirmada</span>
          <span className="ag-ok-sub" style={{ display: "block", fontSize: 12, color: C.suave }}>Cancelar</span></span>
      </button>
    );
    if (e.inscrivel === false) return <span style={{ fontSize: 13, fontWeight: 700, color: C.claro }}>Inscrições encerradas</span>;
    return <button className="ag-btn" onClick={() => onConfirmar(e)}>Confirmar presença</button>;
  };

  const cartao = (e: EventoAgenda) => {
    const t = TIPOS[e.trilha] || TIPOS.growth;
    const d = dataDe(e);
    const passado = !!d && d < hoje;
    const ehProx = proximo?.id === e.id;
    return (
      <article key={e.id} className={`ag-ev${ehProx ? " prox" : ""}${passado ? " passado" : ""}`}>
        <div className="ag-data" style={{ borderTop: `3px solid ${t.cor}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.suave }}>{d ? SEMANA[d.getDay()] : ""}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.tinta, lineHeight: 1.1 }}>{d ? d.getDate() : "–"}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.suave, textTransform: "uppercase" }}>{d ? MESES[d.getMonth()].slice(0, 3) : ""}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: C.suave }}>
            <Ponto cor={t.cor} />{t.rotulo}
            {ehProx && <span style={{ marginLeft: 4, background: C.olivaClaro, color: C.olivaEsc, borderRadius: 100, padding: "2px 8px", letterSpacing: 0.5 }}>Próximo</span>}
            {passado && <span style={{ marginLeft: 4, background: "var(--p-hover)", color: C.suave, borderRadius: 100, padding: "2px 8px", letterSpacing: 0.5 }}>Realizado</span>}
          </div>
          <h3 style={{ margin: "4px 0 2px", fontSize: 17, fontWeight: 700, color: C.tinta, letterSpacing: -0.2 }}>{e.titulo}{e.local ? ` · ${e.local}` : ""}</h3>
          <div style={{ fontSize: 14, color: C.suave }}>{e.quando}{e.diaSemana ? ` · ${e.diaSemana}` : ""}</div>
        </div>
        <div className="ag-acao">{acao(e)}</div>
      </article>
    );
  };

  return (
    <div className="ag">
      <style>{CSS}</style>
      {galeriaDe?.galeria && <GaleriaEvento evento={galeriaDe} galeria={galeriaDe.galeria} onFechar={() => setGaleriaDe(null)} />}
      <section className="ag-hero">
        <div className="ag-hero-in">
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 14, letterSpacing: 0, fontWeight: 600, color: C.oliva }}>Agenda 2026 / 27</div>
            <h1 style={{ margin: "8px 0 8px", fontSize: 34, lineHeight: 1.12, fontWeight: 700, letterSpacing: -0.6, color: "var(--p-text)" }}>A jornada do ano em um só lugar</h1>
            <p style={{ margin: 0, color: "var(--p-muted)", fontSize: 15.5, lineHeight: 1.5 }}>Imersões, Business Day, Growth Sessions e reuniões de conselho. Confirme sua presença com um clique.</p>
            <div style={{ display: "flex", gap: 22, marginTop: 18, color: "var(--p-muted)", fontSize: 13.5 }}>
              <span><strong style={{ color: "var(--p-text)", fontSize: 18 }}>{ordenados.length}</strong> encontros</span>
              <span><strong style={{ color: "var(--p-text)", fontSize: 18 }}>{confirmados}</strong> com sua presença confirmada</span>
            </div>
          </div>
          {proximo && (() => {
            const t = TIPOS[proximo.trilha] || TIPOS.growth;
            return (
              <div className="ag-prox">
                <div style={{ fontSize: 13, letterSpacing: 0, fontWeight: 600, color: C.oliva }}>Próximo encontro · {quandoTexto(diasAte(proximo))}</div>
                <div style={{ fontSize: 17, fontWeight: 700, margin: "8px 0 4px" }}>{proximo.titulo}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--p-muted)", fontSize: 13.5 }}><Ponto cor={t.cor === C.tinta ? "#fff" : t.cor} />{t.rotulo} · {proximo.quando}</div>
              </div>
            );
          })()}
        </div>
      </section>

      <div className="ag-barra">
        <div className="ag-barra-in">
          {[["todos", "Todos", ordenados.length] as const, ...Object.entries(TIPOS).map(([id, t]) => [id, t.plural, conta(id)] as const)].map(([id, r, n]) => (
            <button key={id} className={`ag-filtro${filtro === id ? " on" : ""}`} onClick={() => setFiltro(id)}>
              {id !== "todos" && <Ponto cor={filtro === id && id === "business-day" ? "#fff" : TIPOS[id].cor} />}
              {r}<span style={{ opacity: 0.55, fontWeight: 600 }}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="ag-lista">
        {carregando && <div style={{ color: C.suave, padding: 20 }}>Carregando agenda...</div>}
        {!carregando && visiveis.length === 0 && realizados.length === 0 && <div style={{ color: C.suave, padding: 20 }}>Nenhum evento nesta categoria.</div>}
        {!carregando && visiveis.length > 0 && <div className="ag-secao" style={{ marginTop: 6 }}><h2>Próximos encontros</h2></div>}
        {grupos.map((g) => (
          <section key={g.chave}>
            <div className="ag-mes">{g.titulo}</div>
            {g.itens.map(cartao)}
          </section>
        ))}
        {!carregando && realizados.length > 0 && (
          <section>
            <div className="ag-secao"><h2>Encontros realizados</h2><span style={{ fontSize: 13.5, color: C.suave }}>{realizados.length} {realizados.length === 1 ? "encontro" : "encontros"}</span></div>
            <p style={{ margin: "0 0 14px", fontSize: 14, color: C.suave }}>Reveja os encontros que já aconteceram. Onde houver, as fotos e os vídeos estão a um clique.</p>
            {realizados.map(cartao)}
          </section>
        )}
      </main>
    </div>
  );
}

// Galeria do evento: abas por dia e por videomaker; cada pasta do Drive aparece embutida no portal.
function GaleriaEvento({ evento, galeria, onFechar }: { evento: EventoAgenda; galeria: Galeria; onFechar: () => void }) {
  const [dia, setDia] = useState(0);
  const [pasta, setPasta] = useState(0);
  const d = galeria.dias[dia];
  const p = d?.pastas[pasta] || d?.pastas[0];
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <div className="gal-fundo" onClick={onFechar}>
      <div className="gal" role="dialog" aria-label={`Fotos e vídeos: ${evento.titulo}`} onClick={(ev) => ev.stopPropagation()}>
        <div className="gal-topo">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--p-accent-text)" }}>Fotos e vídeos</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>{evento.titulo}{evento.local ? ` · ${evento.local}` : ""}</div>
              <div style={{ fontSize: 13.5, color: "var(--p-muted)" }}>{evento.quando}</div>
            </div>
            {galeria.pasta && <a className="ag-btn2" href={`https://drive.google.com/drive/folders/${galeria.pasta}`} target="_blank" rel="noreferrer">Abrir no Drive</a>}
            <button className="gal-x" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="pv-seg" style={{ alignSelf: "flex-start" }}>
            {galeria.dias.map((x, i) => <button key={x.titulo} className={i === dia ? "on" : ""} onClick={() => { setDia(i); setPasta(0); }}>{x.titulo}</button>)}
          </div>
          {d && d.pastas.length > 1 && (
            <div className="gal-chips">
              {d.pastas.map((x, i) => <button key={x.id} className={`gal-chip${p?.id === x.id ? " on" : ""}`} onClick={() => setPasta(i)}>{x.nome}</button>)}
            </div>
          )}
        </div>
        <div className="gal-corpo">
          {p ? <iframe key={p.id} title={`${d.titulo} · ${p.nome}`} src={`https://drive.google.com/embeddedfolderview?id=${p.id}#grid`} loading="lazy" />
            : <div style={{ padding: 30, color: "#555" }}>Nenhuma pasta neste dia.</div>}
        </div>
      </div>
    </div>
  );
}
