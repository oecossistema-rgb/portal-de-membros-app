import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Aba = "membros" | "eventos" | "presencas";

type Membro = {
  id: string;
  nome: string | null;
  email: string | null;
  empresa: string | null;
  segmento: string | null;
  telefone_whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean | null;
  is_admin: boolean;
  auth_user_id: string | null;
};

type Evento = {
  id: string;
  trilha: string;
  titulo: string;
  quando: string;
  dia_semana: string | null;
  data_inicio: string;
  inscricoes_abertas: boolean;
  ativo: boolean;
};

type Presenca = {
  id: number;
  evento_id: string;
  membro: string;
  membro_login: string;
  confirmado_em: string;
};

const TRILHAS: Record<string, string> = {
  imersao: "Imersão",
  "business-day": "Business Day",
  growth: "Growth Session",
  conselho: "Conselho",
};

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function dataPorExtenso(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return { quando: "", dia: "" };
  const dt = new Date(a, m - 1, d);
  return { quando: `${d} de ${MESES[m - 1]} de ${a}`, dia: DIAS[dt.getDay()] };
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Admin() {
  const [aba, setAba] = useState<Aba>("membros");
  return (
    <>
      <section style={ui.hero}>
        <div style={ui.heroInner}>
          <div style={ui.heroEyebrow}>Administração</div>
          <h1 style={ui.heroTitle}>Painel do administrador.</h1>
          <p style={ui.heroSub}>Gerencie quem tem acesso ao portal, a agenda de eventos e as confirmações de presença.</p>
        </div>
      </section>
      <div style={{ maxWidth: 1100, margin: "-28px auto 0", padding: "0 24px", display: "flex", gap: 8, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
        {([["membros", "Membros"], ["eventos", "Eventos"], ["presencas", "Presenças"]] as [Aba, string][]).map(([id, r]) => (
          <button key={id} onClick={() => setAba(id)} style={{ ...ui.botaoSecundario, borderRadius: 100, padding: "9px 18px", ...(aba === id ? { background: "#1A1F2B", color: "#fff", borderColor: "#1A1F2B" } : {}) }}>{r}</button>
        ))}
      </div>
      {aba === "membros" && <AdminMembros />}
      {aba === "eventos" && <AdminEventos />}
      {aba === "presencas" && <AdminPresencas />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* MEMBROS                                                             */
/* ------------------------------------------------------------------ */

const MEMBRO_VAZIO: Omit<Membro, "id" | "auth_user_id"> = {
  nome: "", email: "", empresa: "", segmento: "", telefone_whatsapp: "", cidade: "", estado: "", ativo: true, is_admin: false,
};

function AdminMembros() {
  const [lista, setLista] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos" | "sem-email" | "sem-acesso">("ativos");
  const [editando, setEditando] = useState<Partial<Membro> | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("membros")
      .select("id,nome,email,empresa,segmento,telefone_whatsapp,cidade,estado,ativo,is_admin,auth_user_id")
      .order("nome");
    setLista((data as Membro[]) || []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  const contagem = useMemo(() => ({
    ativos: lista.filter((m) => m.ativo).length,
    inativos: lista.filter((m) => !m.ativo).length,
    semEmail: lista.filter((m) => m.ativo && !m.email).length,
    semAcesso: lista.filter((m) => m.ativo && m.email && !m.auth_user_id).length,
  }), [lista]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter((m) => {
      if (filtro === "ativos" && !m.ativo) return false;
      if (filtro === "inativos" && m.ativo) return false;
      if (filtro === "sem-email" && (!m.ativo || m.email)) return false;
      if (filtro === "sem-acesso" && (!m.ativo || !m.email || m.auth_user_id)) return false;
      if (!t) return true;
      return [m.nome, m.email, m.empresa, m.segmento].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [lista, busca, filtro]);

  async function salvar() {
    if (!editando) return;
    const nome = (editando.nome || "").trim();
    if (nome.length < 2) { setMsg({ tipo: "erro", texto: "Informe o nome." }); return; }
    const dados = {
      nome,
      email: (editando.email || "").trim().toLowerCase() || null,
      empresa: (editando.empresa || "").trim() || null,
      segmento: (editando.segmento || "").trim() || null,
      telefone_whatsapp: (editando.telefone_whatsapp || "").replace(/\D/g, "") || null,
      cidade: (editando.cidade || "").trim() || null,
      estado: (editando.estado || "").trim().toUpperCase() || null,
      ativo: !!editando.ativo,
      is_admin: !!editando.is_admin,
    };
    const { error } = editando.id
      ? await supabase.from("membros").update(dados).eq("id", editando.id)
      : await supabase.from("membros").insert(dados);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message.includes("membros_email_unique") ? "Já existe um membro com esse e-mail." : "Não foi possível salvar." });
      return;
    }
    setEditando(null);
    setMsg({ tipo: "ok", texto: editando.id ? "Membro atualizado." : "Membro incluído. Ele já pode criar a senha em \"Primeiro acesso\"." });
    carregar();
  }

  async function excluir(m: Membro) {
    if (!confirm(`Excluir definitivamente "${m.nome}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("membros").delete().eq("id", m.id);
    setMsg(error ? { tipo: "erro", texto: "Não foi possível excluir." } : { tipo: "ok", texto: "Membro excluído." });
    carregar();
  }

  const chips: [typeof filtro, string, number][] = [
    ["ativos", "Ativos", contagem.ativos],
    ["sem-email", "Sem e-mail", contagem.semEmail],
    ["sem-acesso", "Ainda não criaram senha", contagem.semAcesso],
    ["inativos", "Inativos", contagem.inativos],
    ["todos", "Todos", lista.length],
  ];

  return (
    <main style={ui.largo}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input style={{ ...ui.input, flex: "1 1 260px" }} placeholder="Buscar por nome, e-mail ou empresa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="cta-btn" style={ui.botao} onClick={() => { setMsg(null); setEditando({ ...MEMBRO_VAZIO }); }}>+ Novo membro</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {chips.map(([id, r, n]) => (
          <button key={id} onClick={() => setFiltro(id)} style={{ ...ui.botaoSecundario, borderRadius: 100, padding: "6px 14px", ...(filtro === id ? { background: "#E8F0D8", borderColor: "#8BAD3F" } : {}) }}>
            {r} <span style={{ color: "#6B8E23" }}>({n})</span>
          </button>
        ))}
      </div>

      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
      {carregando ? <div style={ui.aviso}>Carregando...</div> : visiveis.length === 0 ? <div style={ui.aviso}>Nenhum membro nesta lista.</div> : (
        visiveis.map((m) => (
          <div key={m.id} style={{ ...ui.cartao, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "#1A1F2B" }}>
                {m.nome || "Sem nome"}
                {m.is_admin && <span style={{ ...chip, background: "#1A1F2B", color: "#fff" }}>Admin</span>}
                {!m.ativo && <span style={{ ...chip, background: "#EAECEF", color: "#45505F" }}>Inativo</span>}
              </div>
              <div style={{ fontSize: 13, color: "#5A6472", marginTop: 2 }}>
                {[m.empresa, m.email || "sem e-mail"].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: m.auth_user_id ? "#4A6118" : "#9AA3B2" }}>
              {m.auth_user_id ? "✓ Já acessa o portal" : "Ainda sem senha"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={ui.botaoSecundario} onClick={() => { setMsg(null); setEditando({ ...m }); }}>Editar</button>
              <button style={ui.botaoPerigo} onClick={() => excluir(m)}>Excluir</button>
            </div>
          </div>
        ))
      )}

      {editando && (
        <Modal titulo={editando.id ? "Editar membro" : "Novo membro"} onFechar={() => setEditando(null)}>
          {[
            ["nome", "Nome completo"], ["email", "E-mail de acesso"], ["empresa", "Empresa"], ["segmento", "Segmento"],
            ["telefone_whatsapp", "WhatsApp (com DDD)"], ["cidade", "Cidade"], ["estado", "Estado (UF)"],
          ].map(([k, r]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <label style={ui.label}>{r}</label>
              <input style={ui.input} value={(editando as Record<string, string>)[k] || ""} onChange={(e) => setEditando({ ...editando, [k]: e.target.value })} />
            </div>
          ))}
          <Caixa marcado={!!editando.ativo} onChange={(v) => setEditando({ ...editando, ativo: v })} texto="Ativo (pode acessar o portal)" />
          <Caixa marcado={!!editando.is_admin} onChange={(v) => setEditando({ ...editando, is_admin: v })} texto="Administrador" />
          {msg?.tipo === "erro" && <div style={ui.erro}>{msg.texto}</div>}
          <button className="cta-btn" style={{ ...ui.botao, width: "100%", marginTop: 8 }} onClick={salvar}>Salvar</button>
        </Modal>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* EVENTOS                                                             */
/* ------------------------------------------------------------------ */

const EVENTO_VAZIO: Partial<Evento> = { trilha: "growth", titulo: "", data_inicio: "", quando: "", dia_semana: "", inscricoes_abertas: true, ativo: true };

function AdminEventos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [totais, setTotais] = useState<Record<string, number>>({});
  const [editando, setEditando] = useState<Partial<Evento> | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    const [{ data: ev }, { data: pr }] = await Promise.all([
      supabase.from("eventos").select("*").order("data_inicio"),
      supabase.from("presencas").select("evento_id"),
    ]);
    setEventos((ev as Evento[]) || []);
    const t: Record<string, number> = {};
    (pr || []).forEach((p: { evento_id: string }) => { t[p.evento_id] = (t[p.evento_id] || 0) + 1; });
    setTotais(t);
  }
  useEffect(() => { carregar(); }, []);

  function mudarData(iso: string) {
    if (!editando) return;
    const { quando, dia } = dataPorExtenso(iso);
    setEditando({ ...editando, data_inicio: iso, quando: editando.id ? editando.quando || quando : quando, dia_semana: editando.id ? editando.dia_semana || dia : dia });
  }

  async function salvar() {
    if (!editando) return;
    if (!editando.titulo?.trim() || !editando.data_inicio || !editando.quando?.trim()) {
      setMsg({ tipo: "erro", texto: "Preencha título, data e o texto da data." });
      return;
    }
    const dados = {
      trilha: editando.trilha,
      titulo: editando.titulo.trim(),
      data_inicio: editando.data_inicio,
      quando: editando.quando.trim(),
      dia_semana: editando.dia_semana?.trim() || null,
      inscricoes_abertas: !!editando.inscricoes_abertas,
      ativo: !!editando.ativo,
    };
    const { error } = editando.id
      ? await supabase.from("eventos").update(dados).eq("id", editando.id)
      : await supabase.from("eventos").insert({ ...dados, id: `${editando.trilha}-${editando.data_inicio}` });
    if (error) {
      setMsg({ tipo: "erro", texto: error.code === "23505" ? "Já existe um evento dessa trilha nessa data." : "Não foi possível salvar." });
      return;
    }
    setEditando(null);
    setMsg({ tipo: "ok", texto: "Evento salvo." });
    carregar();
  }

  return (
    <main style={ui.largo}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="cta-btn" style={ui.botao} onClick={() => { setMsg(null); setEditando({ ...EVENTO_VAZIO }); }}>+ Novo evento</button>
      </div>
      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
      {eventos.map((e) => (
        <div key={e.id} style={{ ...ui.cartao, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", opacity: e.ativo ? 1 : 0.55 }}>
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 700 }}>
              {e.titulo}
              <span style={{ ...chip, background: "#E8F0D8", color: "#4A6118" }}>{TRILHAS[e.trilha] || e.trilha}</span>
              {!e.ativo && <span style={{ ...chip, background: "#EAECEF", color: "#45505F" }}>Oculto</span>}
              {e.ativo && !e.inscricoes_abertas && <span style={{ ...chip, background: "#F7E4E4", color: "#9A3B3B" }}>Inscrições fechadas</span>}
            </div>
            <div style={{ fontSize: 13, color: "#5A6472", marginTop: 2 }}>{e.quando}{e.dia_semana ? ` · ${e.dia_semana}` : ""}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#4A6118" }}>{totais[e.id] || 0} confirmados</div>
          <button style={ui.botaoSecundario} onClick={() => { setMsg(null); setEditando({ ...e }); }}>Editar</button>
        </div>
      ))}

      {editando && (
        <Modal titulo={editando.id ? "Editar evento" : "Novo evento"} onFechar={() => setEditando(null)}>
          <label style={ui.label}>Tipo</label>
          <select style={{ ...ui.input, marginBottom: 12 }} value={editando.trilha} disabled={!!editando.id} onChange={(ev) => setEditando({ ...editando, trilha: ev.target.value })}>
            {Object.entries(TRILHAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
          <label style={ui.label}>Título</label>
          <input style={{ ...ui.input, marginBottom: 12 }} value={editando.titulo || ""} onChange={(ev) => setEditando({ ...editando, titulo: ev.target.value })} />
          <label style={ui.label}>Data (primeiro dia)</label>
          <input type="date" style={{ ...ui.input, marginBottom: 12 }} value={editando.data_inicio || ""} onChange={(ev) => mudarData(ev.target.value)} />
          <label style={ui.label}>Como a data aparece para os membros</label>
          <input style={{ ...ui.input, marginBottom: 12 }} placeholder="Ex.: 13 e 14 de Novembro de 2026" value={editando.quando || ""} onChange={(ev) => setEditando({ ...editando, quando: ev.target.value })} />
          <label style={ui.label}>Dia da semana</label>
          <input style={{ ...ui.input, marginBottom: 12 }} placeholder="Ex.: Sexta e Sábado" value={editando.dia_semana || ""} onChange={(ev) => setEditando({ ...editando, dia_semana: ev.target.value })} />
          <Caixa marcado={!!editando.inscricoes_abertas} onChange={(v) => setEditando({ ...editando, inscricoes_abertas: v })} texto="Inscrições abertas (membros podem confirmar presença)" />
          <Caixa marcado={!!editando.ativo} onChange={(v) => setEditando({ ...editando, ativo: v })} texto="Visível na agenda" />
          {msg?.tipo === "erro" && <div style={ui.erro}>{msg.texto}</div>}
          <button className="cta-btn" style={{ ...ui.botao, width: "100%", marginTop: 8 }} onClick={salvar}>Salvar</button>
        </Modal>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* PRESENÇAS                                                           */
/* ------------------------------------------------------------------ */

function AdminPresencas() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [todas, setTodas] = useState<Presenca[]>([]);
  const [eventoId, setEventoId] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setCarregando(true);
    const [{ data: ev }, { data: pr, error }] = await Promise.all([
      supabase.from("eventos").select("*").order("data_inicio"),
      supabase.from("presencas").select("id,evento_id,membro,membro_login,confirmado_em").order("confirmado_em", { ascending: false }),
    ]);
    setEventos((ev as Evento[]) || []);
    setTodas((pr as Presenca[]) || []);
    setErro(error ? "Não foi possível carregar as presenças." : "");
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  const porEvento = useMemo(() => {
    const t: Record<string, number> = {};
    todas.forEach((p) => { t[p.evento_id] = (t[p.evento_id] || 0) + 1; });
    return t;
  }, [todas]);

  const nomeEvento = (id: string) => {
    const e = eventos.find((x) => x.id === id);
    return e ? `${e.titulo} — ${e.quando}` : id;
  };

  const visiveis = eventoId === "todos" ? todas : todas.filter((p) => p.evento_id === eventoId);

  async function remover(p: Presenca) {
    if (!confirm(`Remover a presença de "${p.membro}"?`)) return;
    await supabase.from("presencas").delete().eq("id", p.id);
    carregar();
  }

  function exportar() {
    const linhas = [["Evento", "Nome", "E-mail", "Confirmado em"], ...visiveis.map((p) => [nomeEvento(p.evento_id), p.membro, p.membro_login, dataCurta(p.confirmado_em)])];
    const csv = "\uFEFF" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `presencas-${eventoId}.csv`;
    a.click();
  }

  return (
    <main style={ui.largo}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <select style={{ ...ui.input, flex: "1 1 320px" }} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
          <option value="todos">Todos os eventos ({todas.length} confirmações)</option>
          {eventos.map((e) => <option key={e.id} value={e.id}>{e.titulo} — {e.quando} ({porEvento[e.id] || 0})</option>)}
        </select>
        <button style={ui.botaoSecundario} onClick={exportar} disabled={!visiveis.length}>Baixar lista (Excel)</button>
      </div>
      {erro && <div style={ui.erro}>{erro}</div>}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#4A6118", marginBottom: 10 }}>{visiveis.length} presença(s) confirmada(s)</div>
      {carregando ? <div style={ui.aviso}>Carregando...</div> : visiveis.length === 0 ? <div style={ui.aviso}>Ninguém confirmou presença neste evento ainda.</div> : visiveis.map((p) => (
        <div key={p.id} style={{ ...ui.cartao, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontWeight: 700 }}>{p.membro}</div>
            <div style={{ fontSize: 13, color: "#5A6472" }}>{p.membro_login} · confirmado em {dataCurta(p.confirmado_em)}</div>
            {eventoId === "todos" && <div style={{ fontSize: 12, color: "#6B8E23", fontWeight: 700, marginTop: 2 }}>{nomeEvento(p.evento_id)}</div>}
          </div>
          <button style={ui.botaoPerigo} onClick={() => remover(p)}>Remover</button>
        </div>
      ))}
    </main>
  );
}

/* ------------------------------------------------------------------ */

const chip: CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, marginLeft: 8, verticalAlign: "middle" };

function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,34,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }} onClick={onFechar}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "28px 24px", maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button onClick={onFechar} aria-label="Fechar" style={{ position: "absolute", top: 12, right: 14, border: "none", background: "none", fontSize: 26, color: "#9AA3B2", cursor: "pointer" }}>×</button>
        <h2 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 18px", color: "#1A1F2B" }}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

function Caixa({ marcado, onChange, texto }: { marcado: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#1A1F2B", margin: "6px 0 12px", cursor: "pointer" }}>
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#8BAD3F" }} />
      {texto}
    </label>
  );
}
