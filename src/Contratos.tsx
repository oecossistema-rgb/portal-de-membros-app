// Administração > Contratos: acompanhamento do contrato de cada membro (rascunho → enviado → assinado).
// O PDF fica num armazenamento PRIVADO (só administradores abrem, por link temporário).
// Pronto para a próxima etapa: o onboarding vai criar o contrato aqui (origem "onboarding") e o envio/assinatura
// passa a acontecer pelo portal.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Status = "rascunho" | "enviado" | "assinado" | "cancelado";
type Contrato = {
  id: string; membro_id: string; titulo: string; plano: string | null; valor: number | null; vigencia_inicio: string | null; vigencia_fim: string | null;
  status: Status; arquivo_path: string | null; assinado_path: string | null; enviado_em: string | null; assinado_em: string | null;
  observacoes: string | null; origem: string; criado_em: string;
};
type Membro = { id: string; nome: string | null; empresa: string | null; foto_url: string | null };

const ROTULO: Record<Status | "sem", { t: string; cor: string }> = {
  sem: { t: "Sem contrato", cor: "var(--p-muted)" },
  rascunho: { t: "Rascunho", cor: "var(--p-text2)" },
  enviado: { t: "Enviado · aguardando assinatura", cor: "var(--p-warn)" },
  assinado: { t: "Assinado", cor: "var(--p-accent-text)" },
  cancelado: { t: "Cancelado", cor: "var(--p-danger)" },
};
const dataBR = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "");
const real = (v: number | null) => (v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

const NOVO = { membro_id: "", titulo: "Contrato Ecossistema Master Business", plano: "", valor: "", vigencia_inicio: "", vigencia_fim: "", observacoes: "" };

export function AdminContratos() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filtro, setFiltro] = useState<Status | "sem" | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState<typeof NOVO | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState("");

  async function carregar() {
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from("membros").select("id,nome,empresa,foto_url").eq("ativo", true).eq("equipe", false).order("nome"),
      supabase.from("contratos").select("*").order("criado_em", { ascending: false }),
    ]);
    setMembros((m as Membro[]) || []);
    setContratos((c as Contrato[]) || []);
  }
  useEffect(() => { carregar(); }, []);

  // Contrato "da vez" de cada membro: o mais recente que não foi cancelado (ou o mais recente de todos).
  const atual = useMemo(() => {
    const m: Record<string, Contrato> = {};
    for (const c of contratos) if (!m[c.membro_id] || (m[c.membro_id].status === "cancelado" && c.status !== "cancelado")) m[c.membro_id] = c;
    return m;
  }, [contratos]);
  const statusDe = (id: string): Status | "sem" => atual[id]?.status || "sem";
  const contagem = useMemo(() => {
    const t: Record<string, number> = { sem: 0, rascunho: 0, enviado: 0, assinado: 0, cancelado: 0 };
    membros.forEach((m) => { t[statusDe(m.id)]++; });
    return t;
  }, [membros, atual]); // eslint-disable-line react-hooks/exhaustive-deps
  const visiveis = membros.filter((m) => (filtro === "todos" || statusDe(m.id) === filtro)
    && (!busca.trim() || `${m.nome} ${m.empresa}`.toLowerCase().includes(busca.trim().toLowerCase())));

  async function enviarPdf(arq: File, membroId: string, sufixo: string): Promise<string | null> {
    if (arq.type !== "application/pdf") { setMsg({ tipo: "erro", texto: "Envie o contrato em PDF." }); return null; }
    const caminho = `${membroId}/${sufixo}-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("contratos").upload(caminho, arq, { contentType: "application/pdf" });
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível guardar o PDF (até 20 MB)." }); return null; }
    return caminho;
  }

  async function criar() {
    if (!novo?.membro_id) { setMsg({ tipo: "erro", texto: "Escolha o membro." }); return; }
    setOcupado("criar");
    const arquivo_path = pdf ? await enviarPdf(pdf, novo.membro_id, "contrato") : null;
    if (pdf && !arquivo_path) { setOcupado(""); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("contratos").insert({
      membro_id: novo.membro_id, titulo: novo.titulo.trim() || NOVO.titulo, plano: novo.plano.trim() || null,
      valor: novo.valor ? Number(novo.valor.replace(/\./g, "").replace(",", ".")) : null,
      vigencia_inicio: novo.vigencia_inicio || null, vigencia_fim: novo.vigencia_fim || null,
      observacoes: novo.observacoes.trim() || null, arquivo_path, criado_por: u.user?.id || null,
    });
    setOcupado("");
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível criar o contrato." }); return; }
    setNovo(null); setPdf(null); setMsg({ tipo: "ok", texto: "Contrato criado como rascunho." }); carregar();
  }

  async function mudar(c: Contrato, campos: Partial<Contrato>, texto: string) {
    const { error } = await supabase.from("contratos").update(campos).eq("id", c.id);
    setMsg(error ? { tipo: "erro", texto: "Não foi possível atualizar." } : { tipo: "ok", texto });
    carregar();
  }

  async function abrir(caminho: string) {
    const { data } = await supabase.storage.from("contratos").createSignedUrl(caminho, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  const nomeDe = (id: string) => membros.find((m) => m.id === id)?.nome || "";

  return (
    <main style={ui.largo}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        {(["sem", "rascunho", "enviado", "assinado"] as const).map((s) => (
          <button key={s} onClick={() => setFiltro(filtro === s ? "todos" : s)}
            style={{ ...ui.cartao, marginBottom: 0, padding: "14px 16px", textAlign: "left", cursor: "pointer", outline: filtro === s ? "2px solid var(--p-accent)" : "none" }}>
            <div style={{ fontSize: 26, fontWeight: 750, color: ROTULO[s].cor }}>{contagem[s]}</div>
            <div style={{ fontSize: 13, color: "var(--p-muted)" }}>{s === "enviado" ? "Aguardando assinatura" : ROTULO[s].t}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input style={{ ...ui.input, flex: "1 1 260px" }} placeholder="Buscar membro ou empresa" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="cta-btn" style={ui.botao} onClick={() => { setMsg(null); setPdf(null); setNovo({ ...NOVO }); }}>+ Novo contrato</button>
      </div>
      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}

      {visiveis.map((m) => {
        const c = atual[m.id]; const st = statusDe(m.id);
        return (
          <div key={m.id} style={{ ...ui.cartao, padding: "12px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {m.foto_url ? <img src={m.foto_url} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }} />
              : <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--p-accent-bg)", color: "var(--p-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{(m.nome || "?")[0]}</div>}
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{m.nome}</div>
              <div style={{ fontSize: 12.5, color: "var(--p-muted)" }}>
                {m.empresa}{c?.plano ? ` · ${c.plano}` : ""}{c?.valor != null ? ` · ${real(c.valor)}` : ""}
                {c?.vigencia_inicio ? ` · ${dataBR(c.vigencia_inicio)}${c.vigencia_fim ? ` a ${dataBR(c.vigencia_fim)}` : ""}` : ""}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ROTULO[st].cor, minWidth: 150 }}>
              {ROTULO[st].t}
              {c?.status === "enviado" && c.enviado_em && <div style={{ fontWeight: 500, color: "var(--p-muted)", fontSize: 12 }}>desde {dataBR(c.enviado_em)}</div>}
              {c?.status === "assinado" && c.assinado_em && <div style={{ fontWeight: 500, color: "var(--p-muted)", fontSize: 12 }}>em {dataBR(c.assinado_em)}</div>}
            </div>
            {c?.arquivo_path && <button style={ui.botaoSecundario} onClick={() => abrir(c.arquivo_path!)}>Ver PDF</button>}
            {c?.assinado_path && <button style={ui.botaoSecundario} onClick={() => abrir(c.assinado_path!)}>Ver assinado</button>}
            {c?.status === "rascunho" && <button style={ui.botaoSecundario} onClick={() => mudar(c, { status: "enviado" }, `Contrato de ${m.nome} marcado como enviado.`)}>Marcar enviado</button>}
            {c?.status === "enviado" && <button className="cta-btn" style={{ ...ui.botao, padding: "8px 16px", fontSize: 13 }} onClick={() => mudar(c, { status: "assinado" }, `Contrato de ${m.nome} assinado.`)}>Marcar assinado</button>}
            {c?.status === "assinado" && !c.assinado_path && (
              <label style={{ ...ui.botaoSecundario, display: "inline-flex", alignItems: "center" }} title="Guarde aqui o PDF assinado">
                {ocupado === c.id ? "Enviando..." : "Anexar assinado"}
                <input type="file" accept="application/pdf" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                  setOcupado(c.id); const p = await enviarPdf(f, m.id, "assinado"); setOcupado("");
                  if (p) mudar(c, { assinado_path: p }, "PDF assinado guardado.");
                }} />
              </label>
            )}
            {c && c.status !== "cancelado" && c.status !== "assinado" && (
              <button style={ui.botaoPerigo} onClick={() => confirm(`Cancelar o contrato de ${m.nome}?`) && mudar(c, { status: "cancelado" }, "Contrato cancelado.")}>Cancelar</button>
            )}
            {(!c || c.status === "cancelado") && <button style={ui.botaoSecundario} onClick={() => { setMsg(null); setPdf(null); setNovo({ ...NOVO, membro_id: m.id }); }}>Criar contrato</button>}
          </div>
        );
      })}
      {!visiveis.length && <div style={ui.aviso}>Nenhum membro nesta situação.</div>}

      {novo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,34,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }} onClick={() => setNovo(null)}>
          <div style={{ background: "var(--p-card)", borderRadius: 18, padding: "26px 22px", maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 16px", color: "var(--p-text)" }}>Novo contrato{novo.membro_id ? ` · ${nomeDe(novo.membro_id)}` : ""}</h2>
            <label style={ui.label}>Membro</label>
            <select style={{ ...ui.input, marginBottom: 12 }} value={novo.membro_id} onChange={(e) => setNovo({ ...novo, membro_id: e.target.value })}>
              <option value="">Escolha...</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.empresa ? ` · ${m.empresa}` : ""}</option>)}
            </select>
            <label style={ui.label}>Título</label>
            <input style={{ ...ui.input, marginBottom: 12 }} value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><label style={ui.label}>Plano</label><input style={{ ...ui.input, marginBottom: 12 }} placeholder="Ex.: Anual" value={novo.plano} onChange={(e) => setNovo({ ...novo, plano: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label style={ui.label}>Valor (R$)</label><input style={{ ...ui.input, marginBottom: 12 }} inputMode="decimal" placeholder="0,00" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value.replace(/[^\d.,]/g, "") })} /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><label style={ui.label}>Início</label><input type="date" style={{ ...ui.input, marginBottom: 12 }} value={novo.vigencia_inicio} onChange={(e) => setNovo({ ...novo, vigencia_inicio: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label style={ui.label}>Fim</label><input type="date" style={{ ...ui.input, marginBottom: 12 }} value={novo.vigencia_fim} onChange={(e) => setNovo({ ...novo, vigencia_fim: e.target.value })} /></div>
            </div>
            <label style={ui.label}>Contrato em PDF</label>
            <input type="file" accept="application/pdf" style={{ ...ui.input, marginBottom: 12 }} onChange={(e) => setPdf(e.target.files?.[0] || null)} />
            <label style={ui.label}>Observações</label>
            <textarea style={{ ...ui.input, minHeight: 70, marginBottom: 12 }} value={novo.observacoes} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} />
            {msg?.tipo === "erro" && <div style={ui.erro}>{msg.texto}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...ui.botaoSecundario, flex: 1 }} onClick={() => setNovo(null)}>Voltar</button>
              <button className="cta-btn" style={{ ...ui.botao, flex: 2 }} onClick={criar} disabled={ocupado === "criar"}>{ocupado === "criar" ? "Salvando..." : "Criar contrato"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
