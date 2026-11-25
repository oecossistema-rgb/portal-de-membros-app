// Administração > Contratos: contrato do membro NOVO (fluxo de 23/11/2026).
//   Aguardando formulário -> Em revisão (abre em tela inteira: Editar -> Salvar -> Enviar) -> Aguardando assinaturas
//   (Autentique: membro, Mennandro e testemunhas) -> Assinado (aí o membro recebe as boas-vindas do portal).
// Os dados pessoais e os PDFs só aparecem para administradores (armazenamento privado, link temporário).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Status = "aguardando_formulario" | "revisao" | "rascunho" | "enviado" | "assinado" | "cancelado";
type Assinatura = { nome: string; email?: string | null; papel: string; link: string | null; assinado_em: string | null; recusado_em: string | null; avisado: boolean; aviso?: string | null };
type Contrato = {
  id: string; membro_id: string; status: Status; token: string; texto: string | null; socio: boolean;
  arquivo_path: string | null; assinado_path: string | null; enviado_em: string | null; assinado_em: string | null;
  formulario_enviado_em: string | null; formulario_respondido_em: string | null; whatsapp_erro: string | null;
  assinaturas: Assinatura[] | null; autentique_id: string | null; autentique_teste: boolean; verificado_em: string | null; criado_em: string; atualizado_em: string;
};
type Membro = { id: string; nome: string | null; empresa: string | null; foto_url: string | null; telefone_whatsapp: string | null };

const ROTULO: Record<Status, { t: string; cor: string }> = {
  aguardando_formulario: { t: "Aguardando formulário", cor: "var(--p-muted)" },
  revisao: { t: "Em revisão", cor: "var(--p-warn)" },
  rascunho: { t: "Rascunho", cor: "var(--p-text2)" },
  enviado: { t: "Aguardando assinaturas", cor: "var(--p-warn)" },
  assinado: { t: "Assinado", cor: "var(--p-accent-text)" },
  cancelado: { t: "Cancelado", cor: "var(--p-danger)" },
};
const PORTAL = "https://portal.oecossistemabusiness.com";
const dataBR = (iso: string | null, hora = false) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "");

async function chamar(corpo: Record<string, unknown>): Promise<{ ok?: boolean; erro?: string; [k: string]: unknown }> {
  const { data, error } = await supabase.functions.invoke("contratos", { body: corpo });
  if (error) {
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return { erro: j.erro }; } catch { /* */ }
    return { erro: "Não foi possível falar com o servidor." };
  }
  return data;
}

export function AdminContratos() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filtro, setFiltro] = useState<Status | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState<string | null>(null); // membro escolhido para receber o formulário
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState("");

  async function carregar() {
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from("membros").select("id,nome,empresa,foto_url,telefone_whatsapp").eq("equipe", false).order("nome"),
      supabase.from("contratos").select("*").neq("autentique_teste", true).order("criado_em", { ascending: false }),
    ]);
    setMembros((m as Membro[]) || []);
    setContratos((c as Contrato[]) || []);
  }
  useEffect(() => { carregar(); }, []);

  const membro = (id: string) => membros.find((m) => m.id === id);
  const contagem = useMemo(() => {
    const t: Record<string, number> = {};
    contratos.forEach((c) => { t[c.status] = (t[c.status] || 0) + 1; });
    return t;
  }, [contratos]);
  const visiveis = contratos.filter((c) => (filtro === "todos" ? c.status !== "cancelado" : c.status === filtro)
    && (!busca.trim() || `${membro(c.membro_id)?.nome} ${membro(c.membro_id)?.empresa}`.toLowerCase().includes(busca.trim().toLowerCase())));

  async function acao(c: Contrato | null, corpo: Record<string, unknown>, okTexto: string) {
    setOcupado(c?.id || "novo"); setMsg(null);
    const r = await chamar(corpo);
    setOcupado("");
    if (r.erro) setMsg({ tipo: "erro", texto: r.erro });
    else setMsg({ tipo: "ok", texto: okTexto });
    await carregar();
    return r;
  }
  const copiar = (t: string) => { navigator.clipboard?.writeText(t).then(() => setMsg({ tipo: "ok", texto: "Link copiado." })).catch(() => {}); };

  const contratoAberto = contratos.find((c) => c.id === aberto) || null;

  return (
    <main style={ui.largo}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        {(["aguardando_formulario", "revisao", "enviado", "assinado"] as const).map((s) => (
          <button key={s} onClick={() => setFiltro(filtro === s ? "todos" : s)}
            style={{ ...ui.cartao, marginBottom: 0, padding: "14px 16px", textAlign: "left", cursor: "pointer", outline: filtro === s ? "2px solid var(--p-accent)" : "none" }}>
            <div style={{ fontSize: 26, fontWeight: 750, color: ROTULO[s].cor }}>{contagem[s] || 0}</div>
            <div style={{ fontSize: 13, color: "var(--p-muted)" }}>{ROTULO[s].t}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input style={{ ...ui.input, flex: "1 1 260px" }} placeholder="Buscar membro ou empresa" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="cta-btn" style={ui.botao} onClick={() => { setMsg(null); setNovo(""); }}>+ Enviar formulário do contrato</button>
      </div>
      {msg && !contratoAberto && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}

      {visiveis.map((c) => {
        const m = membro(c.membro_id);
        const ass = (c.assinaturas || []);
        const feitas = ass.filter((a) => a.assinado_em).length;
        return (
          <div key={c.id} style={{ ...ui.cartao, padding: "12px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", cursor: c.texto ? "pointer" : "default" }}
            onClick={() => c.texto && setAberto(c.id)}>
            {m?.foto_url ? <img src={m.foto_url} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }} />
              : <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--p-accent-bg)", color: "var(--p-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{(m?.nome || "?")[0]}</div>}
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{m?.nome || "Membro"}{c.socio ? " + sócio" : ""}</div>
              <div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>{m?.empresa || ""}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ROTULO[c.status].cor, minWidth: 170 }}>
              {ROTULO[c.status].t}{c.status === "enviado" && ass.length ? ` (${feitas} de ${ass.length})` : ""}
              <div style={{ fontWeight: 500, color: "var(--p-muted)", fontSize: 12 }}>
                {c.status === "aguardando_formulario" && (c.whatsapp_erro ? `WhatsApp não enviado: ${c.whatsapp_erro}` : c.formulario_enviado_em ? `link enviado em ${dataBR(c.formulario_enviado_em)}` : "")}
                {c.status === "revisao" && c.formulario_respondido_em && `preenchido em ${dataBR(c.formulario_respondido_em)}`}
                {c.status === "enviado" && c.enviado_em && `enviado em ${dataBR(c.enviado_em)}`}
                {c.status === "assinado" && c.assinado_em && `em ${dataBR(c.assinado_em)}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
              {c.status === "aguardando_formulario" && <>
                <button style={ui.botaoSecundario} disabled={ocupado === c.id} onClick={() => acao(c, { acao: "reenviar_link", id: c.id }, `Link reenviado para ${m?.nome}.`)}>{ocupado === c.id ? "Enviando..." : "Reenviar link"}</button>
                <button style={ui.botaoSecundario} onClick={() => copiar(`${PORTAL}/#contrato/${c.token}`)}>Copiar link</button>
              </>}
              {c.texto && <button className={c.status === "revisao" ? "cta-btn" : undefined} style={c.status === "revisao" ? { ...ui.botao, padding: "8px 16px", fontSize: 13 } : ui.botaoSecundario} onClick={() => setAberto(c.id)}>{c.status === "revisao" ? "Revisar" : "Abrir"}</button>}
              {c.status !== "cancelado" && c.status !== "assinado" && (
                <button style={ui.botaoPerigo} onClick={() => confirm(`Cancelar o contrato de ${m?.nome}?`) && acao(c, { acao: "cancelar", id: c.id }, "Contrato cancelado.")}>Cancelar</button>
              )}
            </div>
          </div>
        );
      })}
      {!visiveis.length && <div style={ui.aviso}>{contratos.length ? "Nenhum contrato nesta situação." : "Nenhum contrato ainda. Quando um membro novo for cadastrado, o contrato dele aparece aqui."}</div>}

      {novo !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,34,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }} onClick={() => setNovo(null)}>
          <div style={{ background: "var(--p-card)", borderRadius: 18, padding: "26px 22px", maxWidth: 520, width: "100%" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 8px", color: "var(--p-text)" }}>Enviar formulário do contrato</h2>
            <p style={{ fontSize: 14, color: "var(--p-muted)", margin: "0 0 14px" }}>Só para membro novo. Ele recebe no WhatsApp o link para preencher os dados do contrato.</p>
            <label style={ui.label}>Membro</label>
            <select style={{ ...ui.input, marginBottom: 14 }} value={novo} onChange={(e) => setNovo(e.target.value)}>
              <option value="">Escolha...</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.empresa ? ` · ${m.empresa}` : ""}{m.telefone_whatsapp ? "" : " (sem WhatsApp)"}</option>)}
            </select>
            {msg?.tipo === "erro" && <div style={ui.erro}>{msg.texto}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...ui.botaoSecundario, flex: 1 }} onClick={() => setNovo(null)}>Voltar</button>
              <button className="cta-btn" style={{ ...ui.botao, flex: 2 }} disabled={!novo || ocupado === "novo"} onClick={async () => {
                const r = await acao(null, { acao: "convidar", membro_id: novo }, `Formulário enviado para ${membro(novo)?.nome}.`);
                if (!r.erro) setNovo(null);
              }}>{ocupado === "novo" ? "Enviando..." : "Enviar no WhatsApp"}</button>
            </div>
          </div>
        </div>
      )}

      {contratoAberto && (
        <TelaContrato c={contratoAberto} nome={membro(contratoAberto.membro_id)?.nome || "Membro"} msg={msg} ocupado={ocupado === contratoAberto.id}
          onFechar={() => { setAberto(null); setMsg(null); }} onAcao={acao} onCopiar={copiar} onSalvo={carregar} setMsg={setMsg} />
      )}
    </main>
  );
}

// Tela inteira do contrato: ler, Editar -> Salvar, Enviar para assinatura, acompanhar as assinaturas.
function TelaContrato({ c, nome, msg, ocupado, onFechar, onAcao, onCopiar, onSalvo, setMsg }: {
  c: Contrato; nome: string; msg: { tipo: "ok" | "erro"; texto: string } | null; ocupado: boolean;
  onFechar: () => void; onAcao: (c: Contrato, corpo: Record<string, unknown>, ok: string) => Promise<unknown>;
  onCopiar: (t: string) => void; onSalvo: () => Promise<void>; setMsg: (m: { tipo: "ok" | "erro"; texto: string } | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(c.texto || "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (!editando) setTexto(c.texto || ""); }, [c.texto, editando]);
  useEffect(() => {
    const b = document.body, antes = b.style.overflow; b.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !editando) onFechar(); };
    window.addEventListener("keydown", esc);
    return () => { b.style.overflow = antes; window.removeEventListener("keydown", esc); };
  }, [editando, onFechar]);

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase.from("contratos").update({ texto }).eq("id", c.id);
    setSalvando(false);
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível salvar." }); return; }
    setEditando(false); setMsg({ tipo: "ok", texto: "Contrato salvo. Agora é só enviar para assinatura." });
    await onSalvo();
  }
  async function abrirPdf(caminho: string) {
    const { data } = await supabase.storage.from("contratos").createSignedUrl(caminho, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  const blocos = (c.texto || "").split(/\n{2,}/).filter((b) => b.trim());
  const ass = c.assinaturas || [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--p-bg)", display: "flex", flexDirection: "column" }} role="dialog" aria-modal="true" aria-label={`Contrato de ${nome}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--p-line)", background: "var(--p-card)", flexWrap: "wrap" }}>
        <button style={ui.botaoSecundario} onClick={() => (editando && texto !== c.texto && !confirm("Sair sem salvar as alterações?")) ? null : onFechar()}>← Voltar</button>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "var(--p-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Contrato · {nome}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: ROTULO[c.status].cor }}>{ROTULO[c.status].t}</div>
        </div>
        {c.status === "revisao" && !editando && <>
          <button style={ui.botaoSecundario} onClick={() => { setMsg(null); setEditando(true); }}>Editar</button>
          <button className="cta-btn" style={{ ...ui.botao, padding: "9px 18px", fontSize: 14 }} disabled={ocupado} onClick={() => {
            if (confirm(`Enviar o contrato de ${nome} para assinatura?\n\nVai para a Autentique e cada assinante (membro, Mennandro e testemunhas) recebe o link no WhatsApp.`))
              onAcao(c, { acao: "enviar", id: c.id }, "Contrato enviado para assinatura.");
          }}>{ocupado ? "Enviando..." : "Enviar para assinatura"}</button>
        </>}
        {editando && <>
          <button style={ui.botaoSecundario} onClick={() => { setTexto(c.texto || ""); setEditando(false); }}>Descartar</button>
          <button className="cta-btn" style={{ ...ui.botao, padding: "9px 18px", fontSize: 14 }} disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</button>
        </>}
        {c.status === "enviado" && <>
          <button style={ui.botaoSecundario} disabled={ocupado} onClick={() => onAcao(c, { acao: "verificar", id: c.id }, "Assinaturas atualizadas.")}>Atualizar</button>
          <button style={ui.botaoSecundario} disabled={ocupado} onClick={() => onAcao(c, { acao: "reenviar_assinatura", id: c.id }, "Links reenviados no WhatsApp para quem ainda não assinou.")}>Reenviar links</button>
        </>}
        {c.autentique_id && (c.status === "enviado" || c.status === "assinado") && (
          // Abre o documento no painel da Autentique (login da conta do Ecossistema) para conferir as assinaturas lá.
          <a style={{ ...ui.botaoSecundario, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            href={`https://painel.autentique.com.br/documentos/${c.autentique_id}`} target="_blank" rel="noopener noreferrer">
            Verificar assinaturas ↗
          </a>
        )}
        {c.arquivo_path && c.status !== "revisao" &&<button style={ui.botaoSecundario} onClick={() => abrirPdf(c.arquivo_path!)}>PDF enviado</button>}
        {c.assinado_path && <button className="cta-btn" style={{ ...ui.botao, padding: "9px 18px", fontSize: 14 }} onClick={() => abrirPdf(c.assinado_path!)}>PDF assinado</button>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 40px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
          {ass.length > 0 && (
            <div style={{ ...ui.cartao, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Assinaturas</div>
              {ass.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? "1px solid var(--p-line)" : "none", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--p-muted)" }}>{a.papel}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 650, color: a.assinado_em ? "var(--p-accent-text)" : a.recusado_em ? "var(--p-danger)" : "var(--p-warn)" }}>
                    {a.assinado_em ? `✓ Assinou em ${dataBR(a.assinado_em, true)}` : a.recusado_em ? "Recusou" : a.aviso ? `Aguardando · ${a.aviso}` : a.avisado ? "Aguardando · link enviado (WhatsApp e e-mail)" : a.email ? "Aguardando · link enviado por e-mail" : "Aguardando · sem WhatsApp, copie o link"}
                  </div>
                  {!a.assinado_em && a.link && <button style={ui.botaoSecundario} onClick={() => onCopiar(a.link!)}>Copiar link</button>}
                </div>
              ))}
              {c.verificado_em && <div style={{ fontSize: 12, color: "var(--p-muted)", marginTop: 6 }}>Conferido na Autentique em {dataBR(c.verificado_em, true)}. O portal confere sozinho a cada 10 minutos.</div>}
            </div>
          )}
          {c.status === "revisao" && !editando && (
            <div style={{ fontSize: 13.5, color: "var(--p-muted)", margin: "0 0 12px" }}>
              Confira o contrato. O que está <b style={{ color: "#C62828" }}>em vermelho</b> muda de um membro para outro (dados do membro, valores e data): revise com atenção. Se precisar mudar algo, clique em <b>Editar</b>. Depois é só <b>Enviar para assinatura</b>.
            </div>
          )}
          {editando ? (
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck
              style={{ ...ui.input, minHeight: "70vh", fontSize: 15, lineHeight: 1.6, padding: "18px 18px", borderRadius: 16, resize: "vertical" }} />
          ) : (
            <article style={{ background: "#fff", color: "#1a1a1a", borderRadius: 16, boxShadow: "var(--p-shadow)", border: "1px solid var(--p-line)", padding: "clamp(20px, 5vw, 56px)", fontSize: 14.5, lineHeight: 1.65 }}>
              {(() => {
                const fimCabecalho = blocos.findIndex((x) => /^De outro lado/.test(x));
                return blocos.map((b, i) => {
                  const titulo = i === 0, forte = titulo || /^CLÁUSULA/.test(b) || /^(\dº PARTICIPANTE|De um lado|De outro lado a CONTRATADA:)/.test(b);
                  // O que muda de um membro para outro (dados do membro, valores e data) fica em vermelho para a revisão.
                  const dadosMembro = i > 0 && (fimCabecalho < 0 || i < fimCabecalho) && /:\s/.test(b) && !/^De um lado/.test(b);
                  const revisar = dadosMembro || /^(5\.1\.|6\.[1-4]\.)\s/.test(b) || /^Salvador, capital/.test(b);
                  const estilo = { margin: titulo ? "0 0 18px" : "0 0 10px", whiteSpace: "pre-wrap" as const, fontWeight: forte ? 700 : 400, textAlign: (titulo ? "center" : "left") as "center" | "left", fontSize: titulo ? 16.5 : undefined, marginTop: /^CLÁUSULA/.test(b) ? 18 : undefined };
                  if (!revisar) return <p key={i} style={estilo}>{b}</p>;
                  return (
                    <p key={i} style={{ ...estilo, color: "#C62828", background: "#FDECEC", borderLeft: "3px solid #E53935", borderRadius: 6, padding: "6px 10px" }}>
                      {dadosMembro ? b.split("\n").map((l, j) => {
                        const k = l.indexOf(": ");
                        return <span key={j}>{j > 0 && "\n"}{k > 0 ? <><span style={{ color: "#1a1a1a" }}>{l.slice(0, k + 2)}</span><b>{l.slice(k + 2)}</b></> : l}</span>;
                      }) : b}
                    </p>
                  );
                });
              })()}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
