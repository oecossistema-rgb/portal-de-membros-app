import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "./supabase";
import { CartaoResumo, type Resumo } from "./ResumoPerfil";

// "Meu Painel": área privada de cada membro (só ele vê). Primeiro módulo: Oportunidades.
// Novos módulos (Ofertas, Conexões, Indicadores...) entram no menu lateral.
// NESTA VERSÃO os dados são de demonstração; o cruzamento pela IA entra na próxima etapa.

export type TipoOp = "cliente" | "ajuda" | "parceria" | "afinidade";
export type Oportunidade = {
  id: string; tipo: TipoOp; nome: string; empresa: string; segmento: string; foto?: string | null;
  motivo: string; forca: 1 | 2 | 3; whatsapp?: string | null; status?: "nova" | "conversei" | "fechou" | "descartada";
  resumo?: Resumo | null;
};

function abrirWhatsapp(numero?: string | null) {
  const t = (numero || "").replace(/\D/g, "");
  if (t) window.open(`https://wa.me/${t.startsWith("55") ? t : `55${t}`}`, "_blank", "noopener");
}

// Versão com dados reais: carrega as oportunidades do membro logado.
export function PainelMembro({ userId, nome }: { userId: string; nome: string }) {
  const [ops, setOps] = useState<Oportunidade[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data: eu } = await supabase.from("membros").select("id").eq("auth_user_id", userId).maybeSingle();
      if (!eu) { setOps([]); return; }
      const { data } = await supabase.from("membros_oportunidades")
        .select("id,tipo,motivo,forca,status,alvo:membros!membros_oportunidades_alvo_id_fkey(nome,empresa,segmento,foto_url,telefone_whatsapp,resumo_publico)")
        .eq("membro_id", eu.id);
      type Linha = { id: string; tipo: TipoOp; motivo: string; forca: 1 | 2 | 3; status: Oportunidade["status"];
        alvo: { nome: string | null; empresa: string | null; segmento: string | null; foto_url: string | null; telefone_whatsapp: string | null; resumo_publico: Resumo | null } | null };
      setOps(((data as unknown as Linha[]) || []).filter((l) => l.alvo).map((l) => ({
        id: l.id, tipo: l.tipo, motivo: l.motivo, forca: l.forca, status: l.status,
        nome: l.alvo!.nome || "", empresa: l.alvo!.empresa || "", segmento: l.alvo!.segmento || "", foto: l.alvo!.foto_url,
        whatsapp: l.alvo!.telefone_whatsapp, resumo: l.alvo!.resumo_publico,
      })));
    })();
  }, [userId]);
  if (ops === null) return <div style={{ padding: 40, textAlign: "center", color: "#6B7482" }}>Carregando seu painel...</div>;
  return <Painel nome={nome} oportunidades={ops} salvar={async (id, st) => { await supabase.rpc("marcar_oportunidade", { p_id: id, p_status: st }); }} />;
}

const C = { tinta: "#1A1F2B", tinta2: "#252C3B", texto: "#3A4250", suave: "#6B7482", oliva: "#8BAD3F", olivaEsc: "#4A6118", olivaClaro: "#F3F7EA", fundo: "#F2F3EE", borda: "#E4E7DE" };

const TIPOS: Record<TipoOp, { titulo: string; curto: string; desc: string; cor: string; cor2: string; icone: IconeNome }> = {
  cliente: { titulo: "Possíveis clientes", curto: "Clientes", desc: "Membros que se encaixam no que você vende", cor: "#8BAD3F", cor2: "#5E7D22", icone: "alvo" },
  ajuda: { titulo: "Quem resolve o que você precisa", curto: "Soluções", desc: "Cruza o que você busca com o que eles oferecem", cor: "#3E6FB0", cor2: "#274D80", icone: "chave" },
  parceria: { titulo: "Parcerias", curto: "Parcerias", desc: "Atendem o mesmo público que você, sem concorrer", cor: "#C08A2E", cor2: "#8E6118", icone: "aperto" },
  afinidade: { titulo: "Afinidades", curto: "Afinidades", desc: "Mesma cidade, esporte ou hobby: bom para quebrar o gelo", cor: "#9A5BB5", cor2: "#6E3A87", icone: "coracao" },
};

const MENU: { id: string; titulo: string; icone: IconeNome; pronto: boolean }[] = [
  { id: "oportunidades", titulo: "Oportunidades", icone: "faisca", pronto: true },
  { id: "ofertas", titulo: "Ofertas", icone: "tag", pronto: false },
  { id: "conexoes", titulo: "Minhas conexões", icone: "rede", pronto: false },
  { id: "indicadores", titulo: "Indicadores", icone: "grafico", pronto: false },
];

type IconeNome = "alvo" | "chave" | "aperto" | "coracao" | "faisca" | "tag" | "rede" | "grafico" | "whats" | "olho" | "check" | "x" | "cadeado";
function Icone({ nome, tam = 18 }: { nome: IconeNome; tam?: number }) {
  const p: Record<IconeNome, ReactNode> = {
    alvo: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
    chave: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>,
    aperto: <><path d="M3 12l4-4 4 3 3-3 3 3 4-4" /><path d="M7 16l3 3 4-4" /></>,
    coracao: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
    faisca: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
    tag: <><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
    rede: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 7.5l2.8 8.5M16 7.5l-2.8 8.5M8.5 6h7" /></>,
    grafico: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    whats: <><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /><path d="M9 9.5c.5 2 2 3.5 4 4l1.2-1.2 2 .8-.4 1.6c-3.6.4-7.5-3.5-7.1-7.1l1.6-.4.8 2z" /></>,
    olho: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    check: <path d="M5 12l4 4 10-10" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    cadeado: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  };
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[nome]}</svg>;
}

// Bloco de ícone com volume (efeito 3D minimalista)
function Cubo({ cor, cor2, icone, tam = 46 }: { cor: string; cor2: string; icone: IconeNome; tam?: number }) {
  return (
    <div style={{
      width: tam, height: tam, borderRadius: tam * 0.3, flex: "0 0 auto", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(145deg, ${cor} 0%, ${cor2} 100%)`,
      boxShadow: `inset 0 2px 0 rgba(255,255,255,.35), inset 0 -3px 0 rgba(0,0,0,.18), 0 8px 16px -6px ${cor2}99`,
    }}><Icone nome={icone} tam={tam * 0.45} /></div>
  );
}

const CSS = `
.pn{display:grid;grid-template-columns:250px 1fr;min-height:calc(100vh - 140px);background:${C.fundo};text-align:left;width:100vw;margin-left:calc(50% - 50vw);box-sizing:border-box}
.pn-menu{background:${C.tinta};padding:22px 14px;display:flex;flex-direction:column;gap:6px}
.pn-item{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;color:#AEB6C2;font-weight:700;font-size:14.5px;border:0;background:transparent;cursor:pointer;font-family:inherit;text-align:left;width:100%}
.pn-item:hover{background:rgba(255,255,255,.06);color:#fff}
.pn-item.on{background:linear-gradient(145deg,#2E3746,#232A37);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 14px rgba(0,0,0,.25)}
.pn-main{padding:32px 40px 56px;max-width:1320px;width:100%;box-sizing:border-box;margin:0 auto}
.pn-3d{background:linear-gradient(180deg,#FFFFFF 0%,#FAFBF8 100%);border:1px solid ${C.borda};border-radius:20px;
  box-shadow:0 1px 0 #fff inset,0 1px 2px rgba(26,31,43,.04),0 12px 28px -14px rgba(26,31,43,.22);transition:transform .2s ease,box-shadow .2s ease}
.pn-op:hover{transform:perspective(900px) rotateX(2deg) translateY(-4px);box-shadow:0 1px 0 #fff inset,0 22px 40px -18px rgba(26,31,43,.35)}
.pn-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
@media (max-width:1100px){.pn-kpis{grid-template-columns:repeat(2,1fr)}}
.pn-kpi{cursor:pointer;text-align:left;font-family:inherit;padding:18px;display:flex;gap:14px;align-items:center}
.pn-kpi.on{border-color:${C.oliva};box-shadow:0 0 0 2px ${C.oliva}55,0 16px 30px -16px rgba(26,31,43,.3)}
.pn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.pn-btn{display:inline-flex;align-items:center;gap:7px;border-radius:11px;padding:9px 13px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;border:1px solid ${C.borda};background:#fff;color:${C.tinta}}
.pn-btn.esc{background:linear-gradient(145deg,#2A3242,#1A1F2B);color:#fff;border-color:#1A1F2B;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 14px -6px rgba(26,31,43,.6)}
.pn-chip{border:1px solid ${C.borda};background:#fff;border-radius:100px;padding:7px 14px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;color:${C.texto}}
.pn-chip.on{background:${C.tinta};color:#fff;border-color:${C.tinta}}
@media (max-width:860px){
  .pn{grid-template-columns:1fr}
  .pn-menu{flex-direction:row;overflow-x:auto;padding:10px}
  .pn-item{width:auto;white-space:nowrap}
  .pn-main{padding:20px 16px 40px}
}`;

// Demonstração (substituída pelo cruzamento da IA na próxima etapa)
export const DEMO: Oportunidade[] = [
  { id: "1", tipo: "cliente", nome: "Robson Lopes", empresa: "Vinevi Estacionamentos", segmento: "Estacionamento e manobristas", motivo: "Opera com equipe grande em campo: pode automatizar a rotina comercial com o seu software.", forca: 3 },
  { id: "2", tipo: "cliente", nome: "André Cardoso", empresa: "Argacril", segmento: "Indústria de tintas", motivo: "Vende B2B por representantes comerciais: perfil ideal para automação de força de vendas.", forca: 3 },
  { id: "3", tipo: "cliente", nome: "Leonardo Azevedo", empresa: "Varejo Brindes", segmento: "Gráfica e brindes", motivo: "Está abrindo novos canais de venda e busca usar tecnologia no comercial.", forca: 2 },
  { id: "4", tipo: "ajuda", nome: "Maylle Cavalcanti", empresa: "Agência Sunshine", segmento: "Marketing e vendas", motivo: "Você busca apoio em marketing e branding; ela faz assessoria de marketing e vendas.", forca: 3 },
  { id: "5", tipo: "ajuda", nome: "Adonias Maia", empresa: "Hub Stratos", segmento: "Inteligência financeira", motivo: "Oferece BPO financeiro e controladoria para empresas em crescimento.", forca: 2 },
  { id: "6", tipo: "parceria", nome: "Janaina Araujo", empresa: "Element Business", segmento: "Fintech B2B", motivo: "Atende áreas comerciais com campanhas de incentivo: soluções complementares à sua.", forca: 3 },
  { id: "7", tipo: "parceria", nome: "Francisco Zanin", empresa: "Rsmx", segmento: "Marketing e sistemas", motivo: "Faz automações comerciais e sites para o mesmo público B2B.", forca: 2 },
  { id: "8", tipo: "afinidade", nome: "Robert Dantas", empresa: "Registre Já", segmento: "Registro de marcas", motivo: "Também é de Feira de Santana e pratica corrida.", forca: 2 },
  { id: "9", tipo: "afinidade", nome: "Daniel Brito", empresa: "DB Med", segmento: "Marketing médico", motivo: "Pratica musculação, como você.", forca: 1 },
];

export function Painel({ nome, oportunidades = DEMO, salvar }: { nome: string; oportunidades?: Oportunidade[]; salvar?: (id: string, s: NonNullable<Oportunidade["status"]>) => Promise<void> }) {
  const [perfil, setPerfil] = useState<Oportunidade | null>(null);
  const [menu, setMenu] = useState("oportunidades");
  const [filtro, setFiltro] = useState<TipoOp | "todas">("todas");
  const [status, setStatus] = useState<Record<string, Oportunidade["status"]>>({});
  const primeiro = nome.trim().split(/\s+/)[0] || "";

  const ativas = oportunidades.filter((o) => (status[o.id] || o.status) !== "descartada");
  const lista = useMemo(() => ativas.filter((o) => filtro === "todas" || o.tipo === filtro).sort((a, b) => b.forca - a.forca), [ativas, filtro]);
  const conta = (t: TipoOp) => ativas.filter((o) => o.tipo === t).length;
  const conversas = Object.values(status).filter((s) => s === "conversei" || s === "fechou").length;

  return (
    <div className="pn">
      <style>{CSS}</style>
      <aside className="pn-menu">
        <div style={{ color: "#6E7787", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, padding: "4px 12px 10px" }}>Meu painel</div>
        {MENU.map((m) => (
          <button key={m.id} className={`pn-item${menu === m.id ? " on" : ""}`} onClick={() => m.pronto && setMenu(m.id)} style={m.pronto ? {} : { cursor: "default", opacity: 0.55 }}>
            <span style={{ display: "flex", color: menu === m.id ? C.oliva : "inherit" }}><Icone nome={m.icone} /></span>
            <span style={{ flex: 1 }}>{m.titulo}</span>
            {!m.pronto && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, border: "1px solid #4A5262", borderRadius: 100, padding: "2px 7px" }}>EM BREVE</span>}
          </button>
        ))}
        <div style={{ marginTop: "auto", display: "flex", gap: 8, alignItems: "center", color: "#7E8796", fontSize: 12, padding: "14px 12px 0" }}>
          <Icone nome="cadeado" tam={14} />Só você vê este painel
        </div>
      </aside>

      <main className="pn-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", color: C.olivaEsc, fontWeight: 800 }}>Oportunidades</div>
            <h1 style={{ margin: "6px 0 4px", fontSize: 30, lineHeight: 1.15, color: C.tinta, fontWeight: 800, letterSpacing: -0.5 }}>{primeiro ? `${primeiro}, ` : ""}{ativas.length} conexões com potencial</h1>
            <p style={{ margin: 0, color: C.suave, fontSize: 15 }}>Cruzamos o seu perfil com os outros membros do Ecossistema.</p>
          </div>
          <div className="pn-3d" style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <Cubo cor="#3B4456" cor2="#1A1F2B" icone="check" tam={36} />
            <div><div style={{ fontSize: 22, fontWeight: 800, color: C.tinta, lineHeight: 1 }}>{conversas}</div><div style={{ fontSize: 12, color: C.suave, fontWeight: 700 }}>conversas iniciadas</div></div>
          </div>
        </div>

        <div className="pn-kpis" style={{ marginBottom: 26 }}>
          {(Object.keys(TIPOS) as TipoOp[]).map((t) => (
            <button key={t} className={`pn-3d pn-kpi${filtro === t ? " on" : ""}`} onClick={() => setFiltro(filtro === t ? "todas" : t)}>
              <Cubo cor={TIPOS[t].cor} cor2={TIPOS[t].cor2} icone={TIPOS[t].icone} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.tinta, lineHeight: 1 }}>{conta(t)}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.texto, marginTop: 4 }}>{TIPOS[t].titulo}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(["todas", ...Object.keys(TIPOS)] as (TipoOp | "todas")[]).map((t) => (
            <button key={t} className={`pn-chip${filtro === t ? " on" : ""}`} onClick={() => setFiltro(t)}>{t === "todas" ? "Todas" : TIPOS[t].curto}</button>
          ))}
        </div>

        <div className="pn-grid">
          {lista.map((o) => <CartaoOp key={o.id} o={o} status={status[o.id] || o.status || "nova"} verPerfil={() => setPerfil(o)} mudar={(s) => { setStatus({ ...status, [o.id]: s }); if (salvar && s) salvar(o.id, s); }} />)}
        </div>
        {lista.length === 0 && <div className="pn-3d" style={{ padding: 30, textAlign: "center", color: C.suave }}>{ativas.length === 0 ? "Seu painel de oportunidades está sendo preparado. Em breve ele aparece aqui." : "Nenhuma oportunidade neste filtro."}</div>}
        {perfil && (
          <div onClick={() => setPerfil(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,24,34,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 720, maxHeight: "calc(100vh - 40px)", overflowY: "auto", position: "relative", boxSizing: "border-box" }}>
              <button onClick={() => setPerfil(null)} aria-label="Fechar" style={{ position: "absolute", top: 14, right: 14, width: 38, height: 38, border: 0, borderRadius: "50%", background: "#F0F1F3", fontSize: 24, cursor: "pointer" }}>×</button>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.tinta }}>{perfil.nome}</div>
              <div style={{ fontWeight: 700, color: C.olivaEsc, margin: "4px 0 18px" }}>{perfil.empresa}</div>
              {perfil.resumo ? <CartaoResumo resumo={perfil.resumo} /> : <div style={{ color: C.suave }}>Perfil ainda sem resumo.</div>}
              {perfil.whatsapp && <button className="pn-btn esc" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: 14 }} onClick={() => abrirWhatsapp(perfil.whatsapp)}><Icone nome="whats" />Conversar pelo WhatsApp</button>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CartaoOp({ o, status, mudar, verPerfil }: { o: Oportunidade; status: NonNullable<Oportunidade["status"]>; mudar: (s: NonNullable<Oportunidade["status"]>) => void; verPerfil: () => void }) {
  const t = TIPOS[o.tipo];
  const etiqueta: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: t.cor2, background: `${t.cor}1F`, borderRadius: 100, padding: "4px 9px" };
  return (
    <article className="pn-3d pn-op" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(${t.cor}, ${t.cor2})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={etiqueta}>{t.curto}</span>
        <span title="Força da conexão" style={{ display: "flex", gap: 3 }}>
          {[1, 2, 3].map((n) => <span key={n} style={{ width: 16, height: 6, borderRadius: 3, background: n <= o.forca ? t.cor : "#E3E6DD" }} />)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {o.foto ? <img src={o.foto} alt="" style={{ width: 48, height: 48, borderRadius: 14, objectFit: "cover" }} />
          : <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(145deg,#2E3746,#1A1F2B)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 19, boxShadow: "inset 0 1px 0 rgba(255,255,255,.15)" }}>{o.nome.charAt(0)}</div>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: C.tinta, fontSize: 16 }}>{o.nome}</div>
          <div style={{ fontSize: 13.5, color: C.olivaEsc, fontWeight: 700 }}>{o.empresa}<span style={{ color: C.suave, fontWeight: 500 }}> · {o.segmento}</span></div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: C.texto, flex: 1 }}>{o.motivo}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {o.whatsapp && <button className="pn-btn esc" onClick={() => abrirWhatsapp(o.whatsapp)}><Icone nome="whats" tam={16} />Chamar</button>}
        <button className="pn-btn" onClick={verPerfil}><Icone nome="olho" tam={16} />Ver perfil</button>
      </div>
      <div style={{ display: "flex", gap: 6, borderTop: `1px solid ${C.borda}`, paddingTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        {([["conversei", "Já conversei"], ["fechou", "Fechamos negócio"]] as const).map(([s, r]) => (
          <button key={s} onClick={() => mudar(status === s ? "nova" : s)} style={{ border: 0, background: status === s ? C.olivaClaro : "transparent", color: status === s ? C.olivaEsc : C.suave, fontWeight: 700, fontSize: 12.5, borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 4, alignItems: "center" }}>
            {status === s && <Icone nome="check" tam={13} />}{r}
          </button>
        ))}
        <button onClick={() => mudar("descartada")} title="Não faz sentido" style={{ marginLeft: "auto", border: 0, background: "transparent", color: "#A2A9B4", cursor: "pointer", display: "flex", padding: 4 }}><Icone nome="x" tam={15} /></button>
      </div>
    </article>
  );
}
