import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

// Resumo da empresa, escrito pela IA a partir do onboarding (sem dados sensíveis, sem diagnóstico)
// e aprovado por um administrador antes de aparecer para os outros membros.
// O desenho é fixo: a IA só preenche os campos abaixo; layout, ordem e cores são sempre os mesmos.
export type Fatos = { fundacao: string; local: string; atende: string; segmento: string };
export type Oferta = { titulo: string; descricao: string };
export type ResumoV2 = {
  versao: 2; fatos: Fatos; frase: string; sobre: string; oferece: Oferta[]; clientes: string[]; canais: string[];
  oportunidades: string[]; busca: string[]; contribui: string[]; proposito: string; fora_do_trabalho: string[];
};
// Formato antigo (primeiros resumos). Continua sendo exibido até ser gerado de novo.
type ResumoV1 = { apresentacao?: string; o_que_faz?: string; pontos_fortes?: string[]; oportunidades?: string[]; como_contribui?: string; interesses?: string };
export type Resumo = ResumoV2 | ResumoV1;

export const RESUMO_VAZIO: ResumoV2 = {
  versao: 2, fatos: { fundacao: "", local: "", atende: "", segmento: "" }, frase: "", sobre: "", oferece: [], clientes: [],
  canais: [], oportunidades: [], busca: [], contribui: [], proposito: "", fora_do_trabalho: [],
};

const ehV2 = (r: Resumo | null | undefined): r is ResumoV2 => !!r && (r as ResumoV2).versao === 2;
const normalizar = (r: Partial<ResumoV2>): ResumoV2 => ({ ...RESUMO_VAZIO, ...r, fatos: { ...RESUMO_VAZIO.fatos, ...(r.fatos || {}) } });

// ---------- cores e peças do desenho ----------
const C = { tinta: "#1A1F2B", texto: "#3A4250", suave: "#6B7482", oliva: "#8BAD3F", olivaEsc: "#4A6118", olivaClaro: "#F3F7EA", borda: "#E6EADF" };

const CSS = `
.rp-wrap{display:flex;flex-direction:column;gap:14px;text-align:left}
.rp-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.rp-fatos{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px}
.rp-card{background:#fff;border:1px solid ${C.borda};border-radius:16px;padding:18px}
.rp-oferta{transition:transform .15s ease, box-shadow .15s ease}
.rp-oferta:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(26,31,43,.08)}
`;

function Icone({ nome }: { nome: "cal" | "pin" | "alvo" | "tag" | "caixa" | "pessoas" | "seta" | "aperto" | "busca" | "mao" | "estrela" | "sol" }) {
  const p: Record<string, ReactNode> = {
    cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
    alvo: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
    tag: <><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
    caixa: <><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
    pessoas: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14c2.8 0 5 2.2 5 5" /></>,
    seta: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    aperto: <><path d="M8 12l3 3 5-6" /><circle cx="12" cy="12" r="9" /></>,
    busca: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
    mao: <><path d="M12 21c-4 0-7-3-7-7V9a1.5 1.5 0 0 1 3 0v3M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-3 7-5 7" /></>,
    estrela: <><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>,
    sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[nome]}</svg>;
}

const rotulo: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, color: C.olivaEsc, margin: "0 0 12px" };
const chip: CSSProperties = { display: "inline-block", background: C.olivaClaro, color: C.olivaEsc, border: `1px solid #DDE8C6`, borderRadius: 100, padding: "6px 12px", fontSize: 13.5, fontWeight: 600, margin: "0 6px 6px 0", lineHeight: 1.3 };

function Secao({ icone, titulo, children }: { icone: Parameters<typeof Icone>[0]["nome"]; titulo: string; children: ReactNode }) {
  return (
    <section className="rp-card">
      <h3 style={rotulo}><span style={{ color: C.oliva, display: "flex" }}><Icone nome={icone} /></span>{titulo}</h3>
      {children}
    </section>
  );
}

function Itens({ itens, icone = "aperto" }: { itens: string[]; icone?: "aperto" | "seta" }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
      {itens.map((x, i) => (
        <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14.5, color: C.texto, lineHeight: 1.45 }}>
          <span style={{ color: C.oliva, flex: "0 0 auto", marginTop: 1, display: "flex" }}><Icone nome={icone} /></span><span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- exibição para os membros (diretório, Meu Perfil e prévia do administrador) ----------
export function CartaoResumo({ resumo }: { resumo: Resumo }) {
  if (!ehV2(resumo)) return <CartaoAntigo resumo={resumo} />;
  const r = normalizar(resumo);
  const fatos = ([
    ["cal", "Desde", r.fatos.fundacao],
    ["pin", "Onde", r.fatos.local],
    ["alvo", "Atende", r.fatos.atende],
    ["tag", "Segmento", r.fatos.segmento],
  ] as const).filter(([, , v]) => v);

  return (
    <div className="rp-wrap">
      <style>{CSS}</style>

      {/* Destaque: o que é a empresa */}
      <section style={{ background: `linear-gradient(135deg, ${C.tinta} 0%, #2A3424 100%)`, borderRadius: 18, padding: "26px 24px", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(139,173,63,.18)" }} />
        <div style={{ fontSize: 11.5, letterSpacing: 2.5, textTransform: "uppercase", color: C.oliva, fontWeight: 800, marginBottom: 10, position: "relative" }}>Resumo da empresa</div>
        <p style={{ fontSize: 21, lineHeight: 1.35, fontWeight: 700, margin: 0, position: "relative", letterSpacing: -0.2 }}>{r.frase}</p>
        {r.sobre && <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#C9D0BC", margin: "12px 0 0", position: "relative" }}>{r.sobre}</p>}
      </section>

      {fatos.length > 0 && (
        <div className="rp-fatos">
          {fatos.map(([ic, k, v]) => (
            <div key={k} style={{ background: C.olivaClaro, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.olivaEsc, fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}><Icone nome={ic} />{k}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.tinta, marginTop: 4, lineHeight: 1.3 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {r.oferece.length > 0 && (
        <Secao icone="caixa" titulo="O que oferece">
          <div className="rp-grid2">
            {r.oferece.map((o, i) => (
              <div key={i} className="rp-oferta" style={{ border: `1px solid ${C.borda}`, borderRadius: 12, padding: "12px 14px", background: "#FCFDFB" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.tinta }}>{o.titulo}</div>
                {o.descricao && <div style={{ fontSize: 13.5, color: C.suave, marginTop: 3, lineHeight: 1.45 }}>{o.descricao}</div>}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {(r.clientes.length > 0 || r.canais.length > 0) && (
        <div className="rp-grid2">
          {r.clientes.length > 0 && (
            <Secao icone="pessoas" titulo="Quem atende"><div>{r.clientes.map((x) => <span key={x} style={chip}>{x}</span>)}</div></Secao>
          )}
          {r.canais.length > 0 && (
            <Secao icone="seta" titulo="Como chega aos clientes"><div>{r.canais.map((x) => <span key={x} style={chip}>{x}</span>)}</div></Secao>
          )}
        </div>
      )}

      {r.oportunidades.length > 0 && (
        <section style={{ background: C.oliva, borderRadius: 16, padding: "18px 20px", color: "#16200A" }}>
          <h3 style={{ ...rotulo, color: "#1F2C0C" }}><Icone nome="estrela" />Oportunidades de negócio</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
            {r.oportunidades.map((x, i) => (
              <li key={i} style={{ display: "flex", gap: 9, fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
                <span style={{ display: "flex", marginTop: 1 }}><Icone nome="seta" /></span><span>{x}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(r.busca.length > 0 || r.contribui.length > 0) && (
        <div className="rp-grid2">
          {r.busca.length > 0 && <Secao icone="busca" titulo="Busca no grupo"><Itens itens={r.busca} /></Secao>}
          {r.contribui.length > 0 && <Secao icone="mao" titulo="Contribui com"><Itens itens={r.contribui} /></Secao>}
        </div>
      )}

      {r.proposito && (
        <section style={{ borderLeft: `4px solid ${C.oliva}`, background: "#FAFBF7", borderRadius: "0 14px 14px 0", padding: "14px 18px" }}>
          <div style={{ fontSize: 11.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, color: C.olivaEsc, marginBottom: 6 }}>Propósito</div>
          <p style={{ margin: 0, fontSize: 16, fontStyle: "italic", color: C.tinta, lineHeight: 1.5 }}>“{r.proposito}”</p>
        </section>
      )}

      {r.fora_do_trabalho.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: C.suave, marginRight: 4 }}><Icone nome="sol" />Fora do trabalho</span>
          {r.fora_do_trabalho.map((x) => <span key={x} style={{ ...chip, background: "#F1F2F4", color: C.texto, borderColor: "#E3E5E9", margin: 0 }}>{x}</span>)}
        </div>
      )}
    </div>
  );
}

function CartaoAntigo({ resumo }: { resumo: ResumoV1 }) {
  const t: CSSProperties = { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#6B8E23", fontWeight: 800, margin: "14px 0 4px" };
  const c: CSSProperties = { fontSize: 15, color: C.tinta, lineHeight: 1.55, margin: 0 };
  return (
    <div style={{ textAlign: "left" }}>
      {resumo.apresentacao && <p style={{ ...c, fontSize: 16 }}>{resumo.apresentacao}</p>}
      {resumo.o_que_faz && (<><div style={t}>O que faz</div><p style={c}>{resumo.o_que_faz}</p></>)}
      {!!resumo.oportunidades?.length && (<><div style={t}>Oportunidades de conexão</div><ul style={{ ...c, paddingLeft: 20 }}>{resumo.oportunidades.map((x) => <li key={x}>{x}</li>)}</ul></>)}
      {resumo.como_contribui && (<><div style={t}>Como contribui com o grupo</div><p style={c}>{resumo.como_contribui}</p></>)}
    </div>
  );
}

// ---------- área do administrador: gerar, revisar/editar, aprovar e retirar ----------
type Rascunho = { status: string; rascunho: Resumo | null; alertas: string[] | null; erro: string | null; gerado_em: string | null };

const STATUS: Record<string, { texto: string; cor: string; fundo: string }> = {
  aprovado: { texto: "Publicado para os membros", cor: "#4A6118", fundo: "#E8F0D8" },
  pendente: { texto: "Aguardando sua aprovação", cor: "#8A6D1A", fundo: "#FBF3DC" },
  gerando: { texto: "Gerando...", cor: "#45505F", fundo: "#EAECEF" },
  erro: { texto: "Erro ao gerar", cor: "#9A3B3B", fundo: "#F7E4E4" },
};

type ListaChave = "clientes" | "canais" | "oportunidades" | "busca" | "contribui" | "fora_do_trabalho";

export function RevisaoResumo({ membroId, nome = "", onAlterado, onPublicado }: { membroId: string; nome?: string; onAlterado?: () => void; onPublicado?: () => void }) {
  const [r, setR] = useState<Rascunho | null>(null);
  const [texto, setTexto] = useState<ResumoV2>(RESUMO_VAZIO);
  const [editando, setEditando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from("membros_resumo").select("status,rascunho,alertas,erro,gerado_em").eq("membro_id", membroId).maybeSingle();
    setR((data as Rascunho) || null);
    setTexto(normalizar((ehV2(data?.rascunho) ? data?.rascunho : {}) as Partial<ResumoV2>));
    setEditando(false);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, [membroId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function gerar() {
    setOcupado("gerar"); setMsg(null);
    if (r?.status === "aprovado") await supabase.rpc("retirar_resumo", { p_membro: membroId });
    const { data, error } = await supabase.functions.invoke("gerar-resumo", { body: { membro_id: membroId } });
    setOcupado("");
    const res = data?.resultados?.[0];
    if (error || !res?.ok) setMsg({ tipo: "erro", texto: `Não foi possível gerar: ${res?.erro || "tente novamente"}.` });
    else setMsg({ tipo: "ok", texto: "Resumo gerado. Confira a prévia e aprove para publicar." });
    await carregar(); onAlterado?.();
  }

  async function aprovar() {
    setOcupado("aprovar"); setMsg(null);
    const limpa = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
    const limpo: ResumoV2 = {
      ...texto,
      oferece: texto.oferece.map((o) => ({ titulo: o.titulo.trim(), descricao: o.descricao.trim() })).filter((o) => o.titulo),
      clientes: limpa(texto.clientes), canais: limpa(texto.canais), oportunidades: limpa(texto.oportunidades),
      busca: limpa(texto.busca), contribui: limpa(texto.contribui), fora_do_trabalho: limpa(texto.fora_do_trabalho),
    };
    const { error } = await supabase.rpc("publicar_resumo", { p_membro: membroId, p_resumo: limpo });
    setOcupado("");
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível publicar." }); return; }
    onAlterado?.();
    if (onPublicado) { onPublicado(); return; }
    setMsg({ tipo: "ok", texto: "Resumo publicado no perfil do membro." });
    await carregar();
  }

  async function retirar() {
    setOcupado("retirar"); setMsg(null);
    const { error } = await supabase.rpc("retirar_resumo", { p_membro: membroId });
    setOcupado("");
    setMsg(error ? { tipo: "erro", texto: "Não foi possível retirar." } : { tipo: "ok", texto: "Resumo retirado do perfil. Ele voltou para revisão." });
    await carregar(); onAlterado?.();
  }

  const primeiro = nome.trim().split(/\s+/)[0] || "";
  if (carregando) return <div style={ui.aviso}>Carregando resumo...</div>;
  const st = r ? STATUS[r.status] : null;
  const antigo = !!r?.rascunho && !ehV2(r.rascunho);

  const area = (valor: string, mudar: (v: string) => void, altura = 56) => (
    <textarea style={{ ...ui.input, minHeight: altura }} value={valor} onChange={(e) => mudar(e.target.value)} />
  );
  const campo = (rot: string, el: ReactNode) => <div style={{ marginBottom: 12 }}><label style={ui.label}>{rot}</label>{el}</div>;
  const lista = (chave: ListaChave, rot: string) =>
    campo(`${rot} (um por linha)`, area(texto[chave].join("\n"), (v) => setTexto({ ...texto, [chave]: v.split("\n") }), 70));
  const fato = (chave: keyof Fatos, rot: string) => (
    <div style={{ flex: "1 1 150px" }}><label style={ui.label}>{rot}</label>
      <input style={ui.input} value={texto.fatos[chave]} onChange={(e) => setTexto({ ...texto, fatos: { ...texto.fatos, [chave]: e.target.value } })} /></div>
  );

  return (
    <div style={{ textAlign: "left" }}>
      <p style={{ fontSize: 13, color: "#5A6472", margin: "0 0 12px" }}>
        Resumo da empresa escrito pela IA, sem faturamento, metas, equipe ou pontos fracos. Só aparece para os outros membros depois que você aprovar.
      </p>
      {st && <div style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: st.cor, background: st.fundo, borderRadius: 100, padding: "5px 12px", marginBottom: 12 }}>{st.texto}</div>}
      {r?.status === "erro" && r.erro && <div style={ui.erro}>Motivo: {r.erro}</div>}
      {r?.alertas && r.alertas.length > 0 && r.status !== "aprovado" && (
        <div style={ui.erro}>Atenção, revise antes de aprovar. O texto pode conter: {r.alertas.join(", ")}.</div>
      )}
      {antigo && <div style={{ ...ui.erro, background: "#FBF3DC", color: "#8A6D1A" }}>Este resumo está no modelo antigo. Clique em "Gerar novamente" para criar no modelo novo.</div>}
      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}

      {r?.rascunho && !antigo ? (
        editando ? (
          <div>
            {campo("Frase principal (o que a empresa é e para quem)", area(texto.frase, (v) => setTexto({ ...texto, frase: v })))}
            {campo("Sobre (até 2 frases)", area(texto.sobre, (v) => setTexto({ ...texto, sobre: v }), 70))}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              {fato("fundacao", "Desde")}{fato("local", "Onde")}{fato("atende", "Atende")}{fato("segmento", "Segmento")}
            </div>
            {campo("O que oferece (um por linha: Título — descrição)", area(
              texto.oferece.map((o) => (o.descricao ? `${o.titulo} — ${o.descricao}` : o.titulo)).join("\n"),
              (v) => setTexto({ ...texto, oferece: v.split("\n").map((l) => { const [t, ...d] = l.split(/\s+[—-]\s+/); return { titulo: t || "", descricao: d.join(" — ") }; }) }), 100))}
            {lista("clientes", "Quem atende")}
            {lista("canais", "Como chega aos clientes")}
            {lista("oportunidades", "Oportunidades de negócio")}
            {lista("busca", "Busca no grupo")}
            {lista("contribui", "Contribui com")}
            {campo("Propósito (1 frase)", area(texto.proposito, (v) => setTexto({ ...texto, proposito: v })))}
            {lista("fora_do_trabalho", "Fora do trabalho")}
          </div>
        ) : (
          <div style={{ border: "1px dashed #D8DCD2", borderRadius: 18, padding: 12, marginBottom: 14, background: "#FBFBF9" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8A93A0", margin: "2px 4px 10px" }}>Prévia: é assim que os outros membros vão ver</div>
            <CartaoResumo resumo={texto} />
          </div>
        )
      ) : !r?.rascunho ? (
        <div style={{ ...ui.aviso, marginBottom: 12 }}>Ainda não há resumo para este membro.</div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {r?.rascunho && !antigo && r.status !== "aprovado" && (
          <button className="cta-btn" style={ui.botao} onClick={aprovar} disabled={!!ocupado}>
            {ocupado === "aprovar" ? "Publicando..." : primeiro ? `Aprovar e publicar o resumo de ${primeiro}` : "Aprovar e publicar"}
          </button>
        )}
        {r?.rascunho && !antigo && r.status === "aprovado" && editando && (
          <button className="cta-btn" style={ui.botao} onClick={aprovar} disabled={!!ocupado}>{ocupado === "aprovar" ? "Salvando..." : "Salvar alterações publicadas"}</button>
        )}
        {r?.rascunho && !antigo && (
          <button style={ui.botaoSecundario} onClick={() => setEditando(!editando)} disabled={!!ocupado}>{editando ? "Ver prévia" : "Editar texto"}</button>
        )}
        <button style={ui.botaoSecundario} onClick={gerar} disabled={!!ocupado}>
          {ocupado === "gerar" ? "Gerando (até 30 s)..." : r?.rascunho ? "Gerar novamente" : "Gerar resumo"}
        </button>
        {r?.status === "aprovado" && <button style={ui.botaoPerigo} onClick={retirar} disabled={!!ocupado}>Retirar do perfil</button>}
      </div>
    </div>
  );
}
