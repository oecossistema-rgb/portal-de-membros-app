import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { CartaoResumo, type Resumo } from "./ResumoPerfil";
import { Ic, V, type IconeV } from "./Visao";

// Oportunidades: painel privado de cada membro (só ele e a administração veem).
// Mesmo padrão visual da Visão geral: cartões escuros, ícones verdes com brilho, botão "Conectar".

export type TipoOp = "cliente" | "ajuda" | "parceria" | "afinidade";
export type Oportunidade = {
  id: string; tipo: TipoOp; nome: string; empresa: string; segmento: string; cidade?: string; foto?: string | null;
  motivo: string; forca: 1 | 2 | 3; whatsapp?: string | null; status?: "nova" | "conversei" | "fechou" | "descartada";
  resumo?: Resumo | null;
};
type Status = NonNullable<Oportunidade["status"]>;

function abrirWhatsapp(numero?: string | null) {
  const t = (numero || "").replace(/\D/g, "");
  if (t) window.open(`https://wa.me/${t.startsWith("55") ? t : `55${t}`}`, "_blank", "noopener");
}

// Carrega as oportunidades do membro logado.
export function PainelMembro({ userId, nome }: { userId: string; nome: string }) {
  const [ops, setOps] = useState<Oportunidade[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data: eu } = await supabase.from("membros").select("id").eq("auth_user_id", userId).maybeSingle();
      if (!eu) { setOps([]); return; }
      const { data } = await supabase.from("membros_oportunidades")
        .select("id,tipo,motivo,forca,status,alvo:membros!membros_oportunidades_alvo_id_fkey(nome,empresa,segmento,cidade,estado,foto_url,logo_url,telefone_whatsapp,resumo_publico)")
        .eq("membro_id", eu.id);
      type Alvo = { nome: string | null; empresa: string | null; segmento: string | null; cidade: string | null; estado: string | null; foto_url: string | null; logo_url: string | null; telefone_whatsapp: string | null; resumo_publico: Resumo | null };
      type Linha = { id: string; tipo: TipoOp; motivo: string; forca: 1 | 2 | 3; status: Status; alvo: Alvo | null };
      setOps(((data as unknown as Linha[]) || []).filter((l) => l.alvo).map((l) => ({
        id: l.id, tipo: l.tipo, motivo: l.motivo, forca: l.forca, status: l.status,
        nome: l.alvo!.nome || "", empresa: l.alvo!.empresa || "", segmento: l.alvo!.segmento || "",
        cidade: [l.alvo!.cidade, l.alvo!.estado].filter(Boolean).join(", "), foto: l.alvo!.logo_url || l.alvo!.foto_url,
        whatsapp: l.alvo!.telefone_whatsapp, resumo: l.alvo!.resumo_publico,
      })));
    })();
  }, [userId]);
  if (ops === null) return <div className="pv-card" style={{ padding: 30, textAlign: "center", color: V.suave }}>Carregando suas oportunidades...</div>;
  return <Painel nome={nome} oportunidades={ops} salvar={async (id, st) => { await supabase.rpc("marcar_oportunidade", { p_id: id, p_status: st }); }} />;
}

const TIPOS: Record<TipoOp, { titulo: string; curto: string; tag: string; icone: IconeV }> = {
  cliente: { titulo: "Clientes Potenciais", curto: "Clientes", tag: "Cliente potencial", icone: "aperto" },
  ajuda: { titulo: "Soluções Compatíveis", curto: "Soluções", tag: "Solução para você", icone: "grafico" },
  parceria: { titulo: "Parcerias Estratégicas", curto: "Parcerias", tag: "Parceria", icone: "estrela" },
  afinidade: { titulo: "Afinidades", curto: "Afinidades", tag: "Afinidade", icone: "pessoas" },
};
const pct = (f: number) => (f >= 3 ? 95 : f === 2 ? 82 : 64);

const CSS = `
.op-kpi{ cursor:pointer; text-align:left; font:inherit; color:inherit; width:100% }
.op-kpi.on{ border-color:${V.verde}; box-shadow:0 0 0 1px ${V.verde}, 0 10px 30px -14px ${V.verde} }
.op-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px }
.op-card{ transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease }
.op-card:hover{ transform:translateY(-3px); border-color:#1F4A31; box-shadow:0 14px 34px -18px ${V.verde}88 }
.op-mark{ border:0; background:transparent; color:${V.suave}; font:inherit; font-size:12px; font-weight:700; border-radius:8px; padding:5px 9px; cursor:pointer; display:inline-flex; gap:5px; align-items:center }
.op-mark:hover{ color:${V.texto}; background:#0F1915 }
.op-mark.on{ color:${V.verde}; background:rgba(43,227,107,.12) }
`;

function KpiOp({ icone, valor, rotulo, ativo, onClick }: { icone: IconeV; valor: number; rotulo: string; ativo: boolean; onClick: () => void }) {
  return (
    <button className={`pv-card pv-glow op-kpi${ativo ? " on" : ""}`} onClick={onClick}
      style={{ padding: "16px", display: "flex", alignItems: "center", gap: 14, minHeight: 76 }}>
      <span style={{ width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#1C4A30,#0C1F15)", border: "1px solid #1F4A31", color: V.verde, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px -6px ${V.verde}` }}><Ic n={icone} t={22} /></span>
      <span>
        <span style={{ display: "block", fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: -0.5 }}>{valor}</span>
        <span style={{ display: "block", fontSize: 12, color: "#C9D3CD", marginTop: 6 }}>{rotulo}</span>
      </span>
    </button>
  );
}

export function Painel({ nome, oportunidades, salvar }: { nome: string; oportunidades: Oportunidade[]; salvar?: (id: string, s: Status) => Promise<void> }) {
  const [filtro, setFiltro] = useState<TipoOp | "todas">("todas");
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [perfil, setPerfil] = useState<Oportunidade | null>(null);
  const primeiro = nome.trim().split(/\s+/)[0] || "";

  const st = (o: Oportunidade): Status => status[o.id] || o.status || "nova";
  const ativas = oportunidades.filter((o) => st(o) !== "descartada");
  const lista = useMemo(() => ativas.filter((o) => filtro === "todas" || o.tipo === filtro).sort((a, b) => b.forca - a.forca), [ativas, filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  const conta = (t: TipoOp) => ativas.filter((o) => o.tipo === t).length;
  const conversas = ativas.filter((o) => st(o) === "conversei" || st(o) === "fechou").length;
  const fechados = ativas.filter((o) => st(o) === "fechou").length;
  const mudar = (o: Oportunidade, s: Status) => { setStatus({ ...status, [o.id]: s }); salvar?.(o.id, s); };

  return (
    <>
      <style>{CSS}</style>
      {/* Cabeçalho */}
      <section className="pv-card" style={{ position: "relative", overflow: "hidden", padding: "22px 26px", border: 0,
        background: "radial-gradient(120% 140% at 100% 0%, rgba(43,227,107,.22) 0%, rgba(43,227,107,0) 45%), linear-gradient(100deg,#06090A 0%,#0A1410 55%,#0D1F16 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 800, color: V.verde, display: "flex", gap: 8, alignItems: "center" }}><Ic n="raio" t={15} />Oportunidades</div>
            <h1 style={{ margin: "8px 0 6px", fontSize: 28, fontWeight: 800, letterSpacing: -0.6, color: "#fff" }}>{primeiro ? `${primeiro}, ` : ""}{ativas.length} conexões com potencial</h1>
            <div style={{ fontSize: 14.5, color: "#C9D3CD" }}>Cruzamos o seu perfil com os outros membros do Ecossistema. Só você vê esta página.</div>
            <div style={{ width: 66, height: 3, borderRadius: 3, background: V.verde, marginTop: 14, boxShadow: `0 0 12px ${V.verde}` }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {[["aperto", conversas, "conversas iniciadas"], ["check", fechados, "negócios fechados"]].map(([ic, v, r]) => (
              <div key={r as string} className="pv-card pv-glow" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", minWidth: 170 }}>
                <span style={{ color: V.verde, filter: `drop-shadow(0 0 6px ${V.verde})` }}><Ic n={ic as IconeV} t={22} /></span>
                <div><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{v as number}</div><div style={{ fontSize: 11.5, color: V.suave, marginTop: 3 }}>{r as string}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Números por tipo (clicáveis) */}
      <div className="pv-kpis">
        {(Object.keys(TIPOS) as TipoOp[]).map((t) => (
          <KpiOp key={t} icone={TIPOS[t].icone} valor={conta(t)} rotulo={TIPOS[t].titulo} ativo={filtro === t} onClick={() => setFiltro(filtro === t ? "todas" : t)} />
        ))}
      </div>

      {/* Filtro */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ color: V.verde, marginTop: 1 }}><Ic n="estrela" t={20} /></span>
          <div><div style={{ fontSize: 15.5, fontWeight: 800 }}>Oportunidades Recomendadas</div><div style={{ fontSize: 12, color: V.suave, marginTop: 2 }}>As mais fortes primeiro.</div></div>
        </div>
        <div className="pv-seg">
          {(["todas", ...Object.keys(TIPOS)] as (TipoOp | "todas")[]).map((t) => (
            <button key={t} className={filtro === t ? "on" : ""} onClick={() => setFiltro(t)}>
              {t === "todas" ? `Todas ${ativas.length}` : `${TIPOS[t].curto} ${conta(t)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Cartões */}
      <div className="op-grid">
        {lista.map((o) => {
          const s = st(o);
          return (
            <article key={o.id} className="pv-card op-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {o.foto ? <img src={o.foto} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover", background: "#0B1210", flex: "0 0 auto" }} />
                  : <span style={{ width: 54, height: 54, borderRadius: 12, background: "linear-gradient(145deg,#173A26,#0C1F15)", border: `1px solid ${V.borda2}`, boxShadow: `0 0 18px -8px ${V.verde}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: V.verde, flex: "0 0 auto" }}>{(o.empresa || o.nome || "?").charAt(0)}</span>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}><span className="pv-chip"><Ic n="escudo" t={11} />Match {pct(o.forca)}%</span></div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.empresa || o.nome}</div>
                  <div style={{ fontSize: 11.5, color: V.suave, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.nome}{o.segmento ? ` · ${o.segmento}` : ""}</div>
                  {o.cidade && <div style={{ fontSize: 11.5, color: "#C9D3CD", display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}><Ic n="pino" t={12} />{o.cidade}</div>}
                </div>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#DDE6E1", minHeight: 36, flex: 1 }}>{o.motivo}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "#C9D3CD", flexWrap: "wrap" }}>
                <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Ic n="grafico" t={13} />Força: <span style={{ color: V.verde, letterSpacing: 1 }}>{"●".repeat(o.forca)}</span><span style={{ color: "#2A3A32", letterSpacing: 1 }}>{"●".repeat(3 - o.forca)}</span></span>
                <span style={{ display: "flex", gap: 5, alignItems: "center" }}><Ic n="tag" t={12} />{TIPOS[o.tipo].tag}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="pv-btn" style={{ flex: 1 }} onClick={() => abrirWhatsapp(o.whatsapp)} disabled={!o.whatsapp} title={o.whatsapp ? "Chamar no WhatsApp" : "Sem WhatsApp cadastrado"}><Ic n="aperto" t={16} />Conectar</button>
                <button onClick={() => setPerfil(o)} title="Ver perfil" style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${V.borda2}`, background: "transparent", color: V.texto, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="info" t={18} /></button>
              </div>
              <div style={{ display: "flex", gap: 4, borderTop: `1px solid ${V.borda}`, paddingTop: 8, alignItems: "center" }}>
                {([["conversei", "Já conversei"], ["fechou", "Fechamos negócio"]] as [Status, string][]).map(([k, r]) => (
                  <button key={k} className={`op-mark${s === k ? " on" : ""}`} onClick={() => mudar(o, s === k ? "nova" : k)}>{s === k && <Ic n="check" t={12} />}{r}</button>
                ))}
                <button className="op-mark" style={{ marginLeft: "auto" }} title="Não faz sentido" onClick={() => mudar(o, "descartada")}>✕</button>
              </div>
            </article>
          );
        })}
      </div>
      {lista.length === 0 && (
        <div className="pv-card" style={{ padding: 30, textAlign: "center", color: V.suave }}>
          {ativas.length === 0 ? "Suas oportunidades estão sendo preparadas. Em breve elas aparecem aqui." : "Nenhuma oportunidade neste filtro."}
        </div>
      )}

      {perfil && (
        <div onClick={() => setPerfil(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
          <div className="pv-card" onClick={(e) => e.stopPropagation()} style={{ padding: 26, width: "100%", maxWidth: 720, maxHeight: "calc(100vh - 40px)", overflowY: "auto", position: "relative", borderColor: V.borda2 }}>
            <button onClick={() => setPerfil(null)} aria-label="Fechar" style={{ position: "absolute", top: 14, right: 14, width: 36, height: 36, border: `1px solid ${V.borda2}`, borderRadius: "50%", background: "#0B1210", color: V.texto, fontSize: 20, cursor: "pointer" }}>×</button>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{perfil.empresa || perfil.nome}</div>
            <div style={{ fontWeight: 700, color: V.verde, margin: "4px 0 18px" }}>{perfil.nome}</div>
            {perfil.resumo ? <CartaoResumo resumo={perfil.resumo} /> : <div style={{ color: V.suave }}>Perfil ainda sem resumo.</div>}
            {perfil.whatsapp && <button className="pv-btn" style={{ width: "100%", marginTop: 18, height: 44 }} onClick={() => abrirWhatsapp(perfil.whatsapp)}><Ic n="aperto" t={16} />Conectar pelo WhatsApp</button>}
          </div>
        </div>
      )}
    </>
  );
}
