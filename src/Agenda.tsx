import { useMemo, useState } from "react";
import type { ReactNode } from "react";

// Agenda de Eventos: visual minimalista, agrupado por mês, com bloco de data e destaque do próximo encontro.
export type EventoAgenda = { id: string; trilha: string; titulo: string; quando: string; diaSemana: string; dataOrdenacao: string; inscrivel?: boolean };

const TIPOS: Record<string, { rotulo: string; plural: string; cor: string }> = {
  imersao: { rotulo: "Imersão", plural: "Imersões", cor: "#8BAD3F" },
  "business-day": { rotulo: "Business Day", plural: "Business Day", cor: "#E9F0EC" },
  growth: { rotulo: "Growth Session", plural: "Growth Sessions", cor: "#B8C98A" },
  conselho: { rotulo: "Conselho", plural: "Conselho", cor: "#5B6577" },
};
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const C = { tinta: "#E9F0EC", texto: "#C9D3CD", suave: "#97A69E", claro: "#6B7A72", oliva: "#2BE36B", olivaEsc: "#2BE36B", olivaClaro: "rgba(43,227,107,.1)", borda: "#1B2A23", fundo: "#0A100E", tinta2: "#0F1915" };

const CSS = `
.ag{ text-align:left }
.ag-hero{ background:radial-gradient(120% 140% at 100% 0%, rgba(43,227,107,.2) 0%, rgba(43,227,107,0) 45%), linear-gradient(100deg,#06090A 0%,#0A1410 55%,#0D1F16 100%); color:#fff; border-radius:14px; border:1px solid #1B2A23 }
.ag-hero-in{ padding:26px 26px 24px; display:flex; gap:24px; align-items:flex-end; justify-content:space-between; flex-wrap:wrap }
.ag-prox{ background:linear-gradient(145deg,#252C3B,#1F2531); border:1px solid #2E3647; border-radius:16px; padding:16px 18px; min-width:260px; box-shadow:inset 0 1px 0 rgba(255,255,255,.05) }
.ag-barra{ background:linear-gradient(180deg,#0E1714 0%,#0B1210 100%); border-bottom:1px solid ${C.borda}; position:sticky; top:64px; z-index:5; border:0; background:#06090A; margin-top:8px }
.ag-barra-in{ padding:10px 0; display:flex; gap:6px; overflow-x:auto }
.ag-filtro{ border:1px solid transparent; background:transparent; border-radius:100px; padding:8px 14px; font:inherit; font-size:14px; font-weight:700; color:${C.texto}; cursor:pointer; white-space:nowrap; display:flex; gap:7px; align-items:center }
.ag-filtro:hover{ background:${C.fundo} }
.ag-filtro.on{ background:#2BE36B; color:#03140A }
.ag-lista{ padding:16px 0 24px }
.ag-mes{ display:flex; align-items:center; gap:12px; margin:26px 0 12px; font-size:12px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:${C.suave} }
.ag-mes:first-child{ margin-top:0 }
.ag-mes::after{ content:""; flex:1; height:1px; background:${C.borda} }
.ag-ev{ display:grid; grid-template-columns:76px 1fr auto; gap:18px; align-items:center; background:linear-gradient(180deg,#0E1714 0%,#0B1210 100%); border:1px solid ${C.borda}; border-radius:16px; padding:14px 18px 14px 14px; margin-bottom:10px; transition:box-shadow .18s ease, transform .18s ease, border-color .18s ease }
.ag-ev:hover{ box-shadow:0 12px 28px -16px rgba(26,31,43,.28); transform:translateY(-1px) }
.ag-ev.prox{ border-color:${C.oliva}; box-shadow:0 0 0 3px ${C.oliva}22 }
.ag-ev.passado{ opacity:.55 }
.ag-data{ border-radius:12px; background:${C.fundo}; text-align:center; padding:9px 0 8px }
.ag-btn{ border:0; background:linear-gradient(180deg,#43F07F 0%,#22D262 100%); color:#03140A; box-shadow:0 6px 18px -8px #2BE36B; border-radius:10px; padding:10px 16px; font:inherit; font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap }
.ag-btn:hover{ filter:brightness(1.06) }
.ag-ok{ display:flex; align-items:center; gap:10px; border:1px solid #1B2A23; background:${C.olivaClaro}; color:${C.olivaEsc}; border-radius:10px; padding:8px 12px; font:inherit; cursor:pointer; text-align:left }
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
  const [verRealizados, setVerRealizados] = useState(false);
  const doFiltro = filtro === "todos" ? ordenados : ordenados.filter((e) => e.trilha === filtro);
  const realizados = doFiltro.filter((e) => { const d = dataDe(e); return d && d < hoje; }).length;
  const visiveis = verRealizados ? doFiltro : doFiltro.filter((e) => { const d = dataDe(e); return !d || d >= hoje; });
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
    if (d && d < hoje) return <span style={{ fontSize: 13, fontWeight: 700, color: C.claro }}>Realizado</span>;
    if (conf) return (
      <button className="ag-ok" onClick={() => onCancelar(e)} title="Clique para cancelar sua presença">
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: C.oliva, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>✓</span>
        <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>Presença confirmada</span>
          <span className="ag-ok-sub" style={{ display: "block", fontSize: 12, color: C.suave }}>Cancelar</span></span>
      </button>
    );
    if (e.inscrivel === false) return <span style={{ fontSize: 13, fontWeight: 700, color: C.claro }}>Inscrições encerradas</span>;
    return <button className="ag-btn" onClick={() => onConfirmar(e)}>Confirmar presença</button>;
  };

  return (
    <div className="ag">
      <style>{CSS}</style>
      <section className="ag-hero">
        <div className="ag-hero-in">
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 800, color: C.oliva }}>Agenda 2026 / 27</div>
            <h1 style={{ margin: "8px 0 8px", fontSize: 34, lineHeight: 1.12, fontWeight: 800, letterSpacing: -0.6, color: "#fff" }}>A jornada do ano em um só lugar</h1>
            <p style={{ margin: 0, color: "#AEB6C2", fontSize: 15.5, lineHeight: 1.5 }}>Imersões, Business Day, Growth Sessions e reuniões de conselho. Confirme sua presença com um clique.</p>
            <div style={{ display: "flex", gap: 22, marginTop: 18, color: "#AEB6C2", fontSize: 13.5 }}>
              <span><strong style={{ color: "#fff", fontSize: 18 }}>{ordenados.length}</strong> encontros</span>
              <span><strong style={{ color: "#fff", fontSize: 18 }}>{confirmados}</strong> com sua presença confirmada</span>
            </div>
          </div>
          {proximo && (() => {
            const t = TIPOS[proximo.trilha] || TIPOS.growth;
            return (
              <div className="ag-prox">
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, color: C.oliva }}>Próximo encontro · {quandoTexto(diasAte(proximo))}</div>
                <div style={{ fontSize: 17, fontWeight: 800, margin: "8px 0 4px" }}>{proximo.titulo}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#AEB6C2", fontSize: 13.5 }}><Ponto cor={t.cor === C.tinta ? "#fff" : t.cor} />{t.rotulo} · {proximo.quando}</div>
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
        {!carregando && visiveis.length === 0 && <div style={{ color: C.suave, padding: 20 }}>Nenhum evento nesta categoria.</div>}
        {!carregando && realizados > 0 && (
          <button onClick={() => setVerRealizados(!verRealizados)} style={{ border: 0, background: "transparent", color: C.suave, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", padding: "0 0 14px" }}>
            {verRealizados ? "Ocultar encontros realizados" : `Ver encontros realizados (${realizados})`}
          </button>
        )}
        {grupos.map((g) => (
          <section key={g.chave}>
            <div className="ag-mes">{g.titulo}</div>
            {g.itens.map((e) => {
              const t = TIPOS[e.trilha] || TIPOS.growth;
              const d = dataDe(e);
              const passado = !!d && d < hoje;
              const ehProx = proximo?.id === e.id;
              return (
                <article key={e.id} className={`ag-ev${ehProx ? " prox" : ""}${passado ? " passado" : ""}`}>
                  <div className="ag-data" style={{ borderTop: `3px solid ${t.cor}` }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: C.suave }}>{d ? SEMANA[d.getDay()] : ""}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: C.tinta, lineHeight: 1.1 }}>{d ? d.getDate() : "–"}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.suave, textTransform: "uppercase" }}>{d ? MESES[d.getMonth()].slice(0, 3) : ""}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: C.suave }}>
                      <Ponto cor={t.cor} />{t.rotulo}
                      {ehProx && <span style={{ marginLeft: 4, background: C.olivaClaro, color: C.olivaEsc, borderRadius: 100, padding: "2px 8px", letterSpacing: 0.5 }}>Próximo</span>}
                    </div>
                    <h3 style={{ margin: "4px 0 2px", fontSize: 17, fontWeight: 800, color: C.tinta, letterSpacing: -0.2 }}>{e.titulo}</h3>
                    <div style={{ fontSize: 14, color: C.suave }}>{e.quando}{e.diaSemana ? ` · ${e.diaSemana}` : ""}</div>
                  </div>
                  <div className="ag-acao">{acao(e)}</div>
                </article>
              );
            })}
          </section>
        ))}
      </main>
    </div>
  );
}
