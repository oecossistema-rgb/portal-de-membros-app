import { useEffect, useMemo, useState } from "react";
import { AdminConteudo } from "./Conteudo";
import { AdminContratos } from "./Contratos";
import type { CSSProperties } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";
import RespostasOnboarding from "./RespostasOnboarding";
import { RevisaoResumo } from "./ResumoPerfil";
import { OportunidadesDoMembro } from "./Painel";
import { baixarPlanilhaOnboarding } from "./planilha";
import Solicitacoes from "./Solicitacoes";
import { PainelAdmin } from "./PainelAdmin";

type Aba = "painel" | "membros" | "eventos" | "presencas" | "conteudo" | "contratos";

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
  equipe: boolean;
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
  vagas: number | null;
  vagas_abrem_em: string | null;
  video_url?: string | null;
  video_previa_url?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  galeria?: { dias?: unknown[]; itens?: unknown[]; indexado_em?: string; conflitos?: Record<string, number> } | null;
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

export default function Admin({ onSolicitacoes }: { onSolicitacoes?: () => void } = {}) {
  const [aba, setAba] = useState<Aba>("painel");
  return (
    <>
      <section style={ui.hero}>
        <div style={ui.heroInner}>
          <div style={ui.heroEyebrow}>Administração</div>
          <h1 style={ui.heroTitle}>Painel do administrador.</h1>
          <p style={ui.heroSub}>Gerencie quem tem acesso ao portal, a agenda de eventos, as presenças, o conteúdo e os contratos.</p>
        </div>
      </section>
      <Solicitacoes onMudou={onSolicitacoes} />
      <div style={{ margin: "14px 0 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([["painel", "Painel"], ["membros", "Membros"], ["eventos", "Eventos"], ["presencas", "Presenças"], ["conteudo", "Conteúdo"], ["contratos", "Contratos"]] as [Aba, string][]).map(([id, r]) => (
          <button key={id} onClick={() => setAba(id)} style={{ ...ui.botaoSecundario, borderRadius: 100, padding: "9px 18px", ...(aba === id ? { background: "linear-gradient(180deg,var(--p-accent) 0%,var(--p-accent) 100%)", color: "var(--p-on-accent)", borderColor: "transparent" } : {}) }}>{r}</button>
        ))}
      </div>
      {aba === "painel" && <PainelAdmin onIr={setAba} />}
      {aba === "membros" && <AdminMembros />}
      {aba === "eventos" && <AdminEventos />}
      {aba === "presencas" && <AdminPresencas />}
      {aba === "conteudo" && <AdminConteudo />}
      {aba === "contratos" && <AdminContratos />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* MEMBROS                                                             */
/* ------------------------------------------------------------------ */

const MEMBRO_VAZIO: Omit<Membro, "id" | "auth_user_id"> = {
  nome: "", email: "", empresa: "", segmento: "", telefone_whatsapp: "", cidade: "", estado: "", ativo: true, is_admin: false, equipe: false,
};

function AdminMembros() {
  const [lista, setLista] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos" | "sem-email" | "sem-acesso" | "equipe">("ativos");
  const [editando, setEditando] = useState<Partial<Membro> | null>(null);
  // Membro novo: passa pelo contrato antes de entrar (ao criar a senha recebe o formulário; portal liberado após as assinaturas).
  const [enviarContrato, setEnviarContrato] = useState(true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [onboarding, setOnboarding] = useState<Record<string, string | null>>({}); // membro_id -> concluído em
  const [vendoOnboarding, setVendoOnboarding] = useState<Membro | null>(null);
  const [abaOnb, setAbaOnb] = useState<"resumo" | "respostas" | "oportunidades">("resumo");
  const [resumos, setResumos] = useState<Record<string, string>>({}); // membro_id -> status do resumo
  const [gerandoLote, setGerandoLote] = useState("");

  async function carregar() {
    setCarregando(true);
    const [{ data }, { data: onb }] = await Promise.all([
      supabase
        .from("membros")
        .select("id,nome,email,empresa,segmento,telefone_whatsapp,cidade,estado,ativo,is_admin,equipe,auth_user_id")
        .order("nome"),
      supabase.from("membros_onboarding").select("membro_id,onboarding_concluido_em"),
    ]);
    const { data: res } = await supabase.from("membros_resumo").select("membro_id,status");
    setResumos(Object.fromEntries(((res as { membro_id: string; status: string }[]) || []).map((r) => [r.membro_id, r.status])));
    setLista((data as Membro[]) || []);
    setOnboarding(Object.fromEntries(((onb as { membro_id: string; onboarding_concluido_em: string | null }[]) || []).map((o) => [o.membro_id, o.onboarding_concluido_em])));
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  const contagem = useMemo(() => ({
    ativos: lista.filter((m) => m.ativo && !m.equipe).length,
    inativos: lista.filter((m) => !m.ativo && !m.equipe).length,
    semEmail: lista.filter((m) => m.ativo && !m.equipe && !m.email).length,
    semAcesso: lista.filter((m) => m.ativo && !m.equipe && m.email && !m.auth_user_id).length,
    equipe: lista.filter((m) => m.equipe).length,
  }), [lista]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter((m) => {
      // A equipe (administra, mas não é membro) só aparece no filtro "Equipe" e em "Todos".
      if (filtro === "equipe") { if (!m.equipe) return false; }
      else if (filtro !== "todos" && m.equipe) return false;
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
      is_admin: !!editando.is_admin || !!editando.equipe,
      equipe: !!editando.equipe,
    };
    const novoComContrato = !editando.id && enviarContrato && !dados.equipe;
    const { error } = editando.id
      ? await supabase.from("membros").update(dados).eq("id", editando.id)
      : await supabase.from("membros").insert({ ...dados, contrato_pendente: novoComContrato });
    if (error) {
      setMsg({ tipo: "erro", texto: error.message.includes("membros_email_unique") ? "Já existe um membro com esse e-mail." : "Não foi possível salvar." });
      return;
    }
    setEditando(null);
    setMsg({ tipo: "ok", texto: editando.id ? "Membro atualizado."
      : novoComContrato ? `Membro incluído. Quando ${nome.split(" ")[0]} criar a senha no portal, recebe no WhatsApp o link do formulário do contrato.`
      : "Membro incluído. Ele já pode criar a senha em \"Primeiro acesso\"." });
    carregar();
  }

  async function excluir(m: Membro) {
    if (!confirm(`Excluir definitivamente "${m.nome}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("membros").delete().eq("id", m.id);
    setMsg(error ? { tipo: "erro", texto: "Não foi possível excluir." } : { tipo: "ok", texto: "Membro excluído." });
    carregar();
  }

  // Gera, em lotes, o resumo de todos os membros que concluíram o onboarding e ainda não têm resumo.
  async function gerarPendentes() {
    setMsg(null);
    let feitos = 0, erros = 0;
    for (let volta = 0; volta < 20; volta++) {
      setGerandoLote(`Gerando resumos... ${feitos} prontos`);
      const { data, error } = await supabase.functions.invoke("gerar-resumo", { body: { pendentes: true } });
      if (error) { erros++; break; }
      const lote = (data?.resultados || []) as { ok: boolean }[];
      feitos += lote.filter((x) => x.ok).length; erros += lote.filter((x) => !x.ok).length;
      if (!lote.length || !data?.restantes) break;
    }
    setGerandoLote("");
    setMsg({ tipo: erros ? "erro" : "ok", texto: `${feitos} resumo(s) gerado(s) para aprovação${erros ? `, ${erros} com erro (abra o membro para ver o motivo)` : ""}.` });
    carregar();
  }
  // Monta o painel privado de oportunidades de todos os membros (usa só resumos aprovados dos outros).
  const [baixando, setBaixando] = useState(false);
  async function baixarPlanilha() {
    setBaixando(true); setMsg(null);
    try {
      const n = await baixarPlanilhaOnboarding();
      setMsg({ tipo: "ok", texto: `Planilha baixada com ${n} membros e as 40 respostas do onboarding. Contém dados privados dos membros: guarde em local restrito.` });
    } catch (e) {
      setMsg({ tipo: "erro", texto: `Não foi possível gerar a planilha: ${e instanceof Error ? e.message : e}` });
    }
    setBaixando(false);
  }

  async function gerarOportunidades() {
    setMsg(null);
    let feitos = 0, erros = 0, depois: string | undefined;
    for (let volta = 0; volta < 30; volta++) {
      setGerandoLote(`Cruzando oportunidades... ${feitos} painéis prontos`);
      const { data, error } = await supabase.functions.invoke("gerar-oportunidades", { body: { todos: true, depois_de: depois } });
      if (error) { erros++; break; }
      const lote = (data?.resultados || []) as { ok: boolean }[];
      feitos += lote.filter((x) => x.ok).length; erros += lote.filter((x) => !x.ok).length;
      depois = data?.depois_de;
      if (!lote.length || !data?.restantes) break;
    }
    setGerandoLote("");
    setMsg({ tipo: erros ? "erro" : "ok", texto: `${feitos} painel(is) de oportunidades atualizados${erros ? `, ${erros} com erro` : ""}.` });
  }
  const aAprovar = Object.values(resumos).filter((s) => s === "pendente").length;

  const chips: [typeof filtro, string, number][] = [
    ["ativos", "Ativos", contagem.ativos],
    ["sem-email", "Sem e-mail", contagem.semEmail],
    ["sem-acesso", "Ainda não criaram senha", contagem.semAcesso],
    ["inativos", "Inativos", contagem.inativos],
    ["equipe", "Equipe", contagem.equipe],
    ["todos", "Todos", lista.length],
  ];

  return (
    <main style={ui.largo}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input style={{ ...ui.input, flex: "1 1 260px" }} placeholder="Buscar por nome, e-mail ou empresa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="cta-btn" style={ui.botao} onClick={() => { setMsg(null); setEditando({ ...MEMBRO_VAZIO }); }}>+ Novo membro</button>
        <button style={ui.botaoSecundario} onClick={gerarPendentes} disabled={!!gerandoLote}>{gerandoLote || "Gerar resumos pendentes (IA)"}</button>
        <button style={ui.botaoSecundario} onClick={gerarOportunidades} disabled={!!gerandoLote}>{gerandoLote ? "Aguarde..." : "Gerar oportunidades (IA)"}</button>
        <button style={ui.botaoSecundario} onClick={baixarPlanilha} disabled={baixando}>{baixando ? "Gerando planilha..." : "Baixar planilha (Excel)"}</button>
      </div>
      {aAprovar > 0 && <div style={{ ...ui.aviso, textAlign: "left", padding: "12px 16px", marginBottom: 12, borderColor: "var(--p-line)", background: "rgba(242,193,78,.08)" }}>
        <strong>{aAprovar}</strong> resumo(s) aguardando sua aprovação. Abra o membro em "Onboarding" para revisar.
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {chips.map(([id, r, n]) => (
          <button key={id} onClick={() => setFiltro(id)} style={{ ...ui.botaoSecundario, borderRadius: 100, padding: "6px 14px", ...(filtro === id ? { background: "color-mix(in srgb, var(--p-accent) 12%, transparent)", borderColor: "var(--p-accent)" } : {}) }}>
            {r} <span style={{ color: "var(--p-accent)" }}>({n})</span>
          </button>
        ))}
      </div>

      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
      {carregando ? <div style={ui.aviso}>Carregando...</div> : visiveis.length === 0 ? <div style={ui.aviso}>Nenhum membro nesta lista.</div> : (
        visiveis.map((m) => (
          <div key={m.id} style={{ ...ui.cartao, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "var(--p-text)" }}>
                {m.nome || "Sem nome"}
                {m.equipe ? <span style={{ ...chip, background: "#3E6FB0", color: "var(--p-text)" }}>Equipe</span>
                  : m.is_admin && <span style={{ ...chip, background: "linear-gradient(180deg,var(--p-accent) 0%,var(--p-accent) 100%)", color: "var(--p-text)" }}>Membro + admin</span>}
                {!m.ativo && <span style={{ ...chip, background: "var(--p-hover)", color: "var(--p-muted)" }}>Inativo</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--p-muted)", marginTop: 2 }}>
                {[m.empresa, m.email || "sem e-mail"].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: m.auth_user_id ? "var(--p-accent-text)" : "var(--p-faint)" }}>
              {m.auth_user_id ? "✓ Já acessa o portal" : "Ainda sem senha"}
              <div style={{ fontWeight: 600, marginTop: 2, color: onboarding[m.id] ? "var(--p-accent-text)" : m.id in onboarding ? "var(--p-warn)" : "var(--p-faint)" }}>
                {m.equipe || (m.is_admin && !onboarding[m.id]) ? "" : onboarding[m.id] ? "✓ Onboarding concluído" : m.id in onboarding ? "Onboarding em andamento" : "Onboarding não iniciado"}
              </div>
              {resumos[m.id] && !m.equipe && (
                <div style={{ fontWeight: 600, marginTop: 2, color: resumos[m.id] === "aprovado" ? "var(--p-accent-text)" : resumos[m.id] === "erro" ? "var(--p-danger)" : "var(--p-warn)" }}>
                  {resumos[m.id] === "aprovado" ? "✓ Resumo publicado" : resumos[m.id] === "pendente" ? "Resumo aguardando aprovação" : resumos[m.id] === "erro" ? "Resumo com erro" : "Gerando resumo"}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={ui.botaoSecundario} onClick={() => { setAbaOnb("resumo"); setVendoOnboarding(m); }}>Onboarding</button>
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
          <div style={{ margin: "12px 0" }}>
            <label style={ui.label}>Tipo de acesso</label>
            <select style={ui.input} value={editando.equipe ? "equipe" : editando.is_admin ? "membro-admin" : "membro"}
              onChange={(e) => { const v = e.target.value; setEditando({ ...editando, equipe: v === "equipe", is_admin: v !== "membro" }); }}>
              <option value="membro">Membro</option>
              <option value="membro-admin">Membro + administrador</option>
              <option value="equipe">Equipe (administra o portal, não é membro)</option>
            </select>
            <div style={{ fontSize: 12.5, color: "var(--p-muted)", marginTop: 6 }}>
              {editando.equipe ? "Acessa a Administração e as telas do portal, mas não aparece na lista de membros, não faz onboarding e não tem resumo nem painel de oportunidades."
                : editando.is_admin ? "É membro normal e também acessa a Administração." : "Acesso de membro ao portal."}
            </div>
          </div>
          {!editando.id && !editando.equipe && (
            <div style={{ background: "var(--p-accent-bg)", borderRadius: 12, padding: "10px 12px", margin: "4px 0 12px" }}>
              <Caixa marcado={enviarContrato} onChange={setEnviarContrato} texto="Membro novo: passa pelo contrato" />
              <div style={{ fontSize: 12.5, color: "var(--p-muted)", marginTop: 4 }}>
                Ao criar a senha, ele recebe no WhatsApp o link do formulário do contrato. O portal só libera depois de todas as assinaturas. Desmarque se for um membro antigo.
              </div>
            </div>
          )}
          {msg?.tipo === "erro" && <div style={ui.erro}>{msg.texto}</div>}
          <button className="cta-btn" style={{ ...ui.botao, width: "100%", marginTop: 8 }} onClick={salvar}>Salvar</button>
        </Modal>
      )}

      {vendoOnboarding && (
        <Modal titulo={`Onboarding · ${vendoOnboarding.nome || "Sem nome"}`} onFechar={() => setVendoOnboarding(null)} largura={abaOnb === "oportunidades" ? 1120 : 720}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {([["resumo", "Resumo do perfil (IA)"], ["oportunidades", "Oportunidades"], ["respostas", "Respostas completas"]] as const).map(([id, r]) => (
              <button key={id} onClick={() => setAbaOnb(id)} style={{ ...ui.botaoSecundario, borderRadius: 100, ...(abaOnb === id ? { background: "color-mix(in srgb, var(--p-accent) 12%, transparent)", borderColor: "var(--p-accent)" } : {}) }}>{r}</button>
            ))}
          </div>
          {abaOnb === "resumo" ? <RevisaoResumo key={vendoOnboarding.id} membroId={vendoOnboarding.id} nome={vendoOnboarding.nome || ""} onAlterado={carregar} onPublicado={() => { const nome = vendoOnboarding.nome || "membro"; setVendoOnboarding(null); setMsg({ tipo: "ok", texto: `Resumo de ${nome} publicado. Já aparece no perfil em "Membros", no bloco "Sobre a empresa".` }); window.scrollTo({ top: 0, behavior: "smooth" }); }} /> : abaOnb === "oportunidades" ? <div className="pv" style={{ display: "flex", flexDirection: "column", gap: 16 }}><OportunidadesDoMembro membroId={vendoOnboarding.id} nome={vendoOnboarding.nome || ""} /></div> : <RespostasOnboarding membroId={vendoOnboarding.id} />}
        </Modal>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* EVENTOS                                                             */
/* ------------------------------------------------------------------ */

const EVENTO_VAZIO: Partial<Evento> = { trilha: "growth", titulo: "", data_inicio: "", quando: "", dia_semana: "", inscricoes_abertas: true, ativo: true, vagas: 5, vagas_abrem_em: null };
// Vagas padrão por tipo de encontro (dá para mudar em cada evento).
const VAGAS_PADRAO: Record<string, number | null> = { growth: 5, conselho: 10 };
// Data e hora no fuso do navegador <-> campo "datetime-local".
const paraCampo = (iso: string | null | undefined) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const doCampo = (v: string) => (v ? new Date(v).toISOString() : null);
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function situacaoVagas(e: Evento, confirmados: number, fila: number): { texto: string; cor: string } | null {
  if (!e.ativo || !e.vagas) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (new Date(`${e.data_inicio}T00:00:00`) < hoje) return { texto: `Realizado · ${confirmados}/${e.vagas}`, cor: "var(--p-warn)" };
  if (!e.inscricoes_abertas) return { texto: `Vagas fechadas · ${confirmados}/${e.vagas}`, cor: "var(--p-danger)" };
  if (e.vagas_abrem_em && new Date(e.vagas_abrem_em) > new Date()) return { texto: `Abre ${dataHora(e.vagas_abrem_em)}`, cor: "var(--p-muted)" };
  if (confirmados >= e.vagas) return { texto: `Esgotado${fila ? ` · ${fila} na fila` : ""}`, cor: "var(--p-warn)" };
  return { texto: `Aberto · ${confirmados}/${e.vagas}`, cor: "var(--p-accent)" };
}

function AdminEventos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [totais, setTotais] = useState<Record<string, number>>({});
  const [filas, setFilas] = useState<Record<string, number>>({});
  const [editando, setEditando] = useState<Partial<Evento> | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    const [{ data: ev }, { data: pr }, { data: fl }] = await Promise.all([
      supabase.from("eventos").select("*").order("data_inicio"),
      supabase.from("presencas").select("evento_id"),
      supabase.from("eventos_lista").select("evento_id").eq("tipo", "fila"),
    ]);
    setEventos((ev as Evento[]) || []);
    const t: Record<string, number> = {};
    (pr || []).forEach((p: { evento_id: string }) => { t[p.evento_id] = (t[p.evento_id] || 0) + 1; });
    setTotais(t);
    const f: Record<string, number> = {};
    (fl || []).forEach((p: { evento_id: string }) => { f[p.evento_id] = (f[p.evento_id] || 0) + 1; });
    setFilas(f);
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
      vagas: editando.vagas && editando.vagas > 0 ? Math.round(editando.vagas) : null,
      vagas_abrem_em: editando.vagas_abrem_em || null,
      hora_inicio: editando.hora_inicio || null,
      hora_fim: editando.hora_fim || null,
      video_url: editando.video_url?.trim() || null,
      video_previa_url: editando.video_previa_url?.trim() || null,
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

  // Envia um vídeo (.mp4) para o armazenamento do portal e devolve o endereço público.
  const [enviandoVideo, setEnviandoVideo] = useState("");
  async function enviarVideo(arq: File, campo: "video_url" | "video_previa_url") {
    if (!editando) return;
    if (arq.size > 50 * 1024 * 1024) { setMsg({ tipo: "erro", texto: "O arquivo passa de 50 MB. Para o vídeo completo, publique no YouTube e cole o link; aqui envie só o trecho curto." }); return; }
    setEnviandoVideo(campo);
    const caminho = `eventos/${editando.id || "novo"}/${campo === "video_url" ? "video" : "previa"}-${Date.now()}.${arq.name.split(".").pop()?.toLowerCase() || "mp4"}`;
    const { error } = await supabase.storage.from("portal-midia").upload(caminho, arq, { contentType: arq.type || "video/mp4", cacheControl: "31536000" });
    setEnviandoVideo("");
    if (error) { setMsg({ tipo: "erro", texto: "Não foi possível enviar o vídeo." }); return; }
    const { data } = supabase.storage.from("portal-midia").getPublicUrl(caminho);
    setEditando({ ...editando, [campo]: data.publicUrl });
  }

  const [indexando, setIndexando] = useState("");
  async function atualizarGaleria(e: Evento) {
    setIndexando(e.id); setMsg(null);
    const { data, error } = await supabase.functions.invoke("galeria-indexar", { body: { evento_id: e.id } });
    setIndexando("");
    if (error || !data?.total) { setMsg({ tipo: "erro", texto: "Não foi possível ler as pastas do Drive deste evento." }); return; }
    const conf = Object.entries(data.conflitos || {}).map(([k, n]) => `${k} (${n})`).join("; ");
    setMsg({ tipo: "ok", texto: `Galeria atualizada: ${data.fotos} fotos e ${data.videos} vídeos.${conf ? ` Arquivos repetidos em mais de um dia (aparecem uma vez só): ${conf}.` : ""}` });
    carregar();
  }

  async function abrirAgora(e: Evento) {
    const { error } = await supabase.from("eventos").update({ vagas_abrem_em: new Date().toISOString(), inscricoes_abertas: true }).eq("id", e.id);
    setMsg(error ? { tipo: "erro", texto: "Não foi possível abrir as vagas." } : { tipo: "ok", texto: `Vagas de "${e.titulo}" abertas.` });
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
              <span style={{ ...chip, background: "color-mix(in srgb, var(--p-accent) 12%, transparent)", color: "var(--p-accent)" }}>{TRILHAS[e.trilha] || e.trilha}</span>
              {!e.ativo && <span style={{ ...chip, background: "var(--p-hover)", color: "var(--p-muted)" }}>Oculto</span>}
              {e.ativo && !e.inscricoes_abertas && <span style={{ ...chip, background: "color-mix(in srgb, var(--p-danger) 10%, transparent)", color: "var(--p-danger)" }}>Inscrições fechadas</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--p-muted)", marginTop: 2 }}>{e.quando}{e.dia_semana ? ` · ${e.dia_semana}` : ""}{e.hora_inicio ? ` · ${e.hora_inicio.slice(0, 5)}${e.hora_fim ? `–${e.hora_fim.slice(0, 5)}` : ""}` : ""}</div>
          </div>
          {(() => { const st = situacaoVagas(e, totais[e.id] || 0, filas[e.id] || 0); return st
            ? <div style={{ fontSize: 13, fontWeight: 700, color: st.cor }}>{st.texto}</div>
            : <div style={{ fontSize: 13, fontWeight: 700, color: "var(--p-accent)" }}>{totais[e.id] || 0} confirmados</div>; })()}
          {e.ativo && e.vagas && e.vagas_abrem_em && new Date(e.vagas_abrem_em) > new Date() && (
            <button style={ui.botaoSecundario} onClick={() => abrirAgora(e)}>Abrir agora</button>
          )}
          {!!e.galeria?.dias?.length && (
            <button style={ui.botaoSecundario} onClick={() => atualizarGaleria(e)} disabled={!!indexando} title="Lê de novo as pastas do Drive (fotos e vídeos)">
              {indexando === e.id ? "Lendo o Drive..." : "Atualizar galeria"}
            </button>
          )}
          <button style={ui.botaoSecundario} onClick={() => { setMsg(null); setEditando({ ...e }); }}>Editar</button>
        </div>
      ))}

      {editando && (
        <Modal titulo={editando.id ? "Editar evento" : "Novo evento"} onFechar={() => setEditando(null)}>
          <label style={ui.label}>Tipo</label>
          <select style={{ ...ui.input, marginBottom: 12 }} value={editando.trilha} disabled={!!editando.id} onChange={(ev) => setEditando({ ...editando, trilha: ev.target.value, vagas: VAGAS_PADRAO[ev.target.value] ?? null })}>
            {Object.entries(TRILHAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
          <label style={ui.label}>Título</label>
          <input style={{ ...ui.input, marginBottom: 12 }} value={editando.titulo || ""} onChange={(ev) => setEditando({ ...editando, titulo: ev.target.value })} />
          <label style={ui.label}>Data (primeiro dia)</label>
          <input type="date" style={{ ...ui.input, marginBottom: 12 }} value={editando.data_inicio || ""} onChange={(ev) => mudarData(ev.target.value)} />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={ui.label}>Começa às</label>
              <input type="time" style={{ ...ui.input, marginBottom: 12 }} value={(editando.hora_inicio || "").slice(0, 5)} onChange={(ev) => setEditando({ ...editando, hora_inicio: ev.target.value || null })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={ui.label}>Termina às</label>
              <input type="time" style={{ ...ui.input, marginBottom: 12 }} value={(editando.hora_fim || "").slice(0, 5)} onChange={(ev) => setEditando({ ...editando, hora_fim: ev.target.value || null })} />
            </div>
          </div>
          <label style={ui.label}>Como a data aparece para os membros</label>
          <input style={{ ...ui.input, marginBottom: 12 }} placeholder="Ex.: 13 e 14 de Novembro de 2026" value={editando.quando || ""} onChange={(ev) => setEditando({ ...editando, quando: ev.target.value })} />
          <label style={ui.label}>Dia da semana</label>
          <input style={{ ...ui.input, marginBottom: 12 }} placeholder="Ex.: Sexta e Sábado" value={editando.dia_semana || ""} onChange={(ev) => setEditando({ ...editando, dia_semana: ev.target.value })} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px" }}>
              <label style={ui.label}>Vagas</label>
              <input type="number" min={1} style={{ ...ui.input, marginBottom: 4 }} placeholder="Sem limite" value={editando.vagas ?? ""}
                onChange={(ev) => setEditando({ ...editando, vagas: ev.target.value ? Number(ev.target.value) : null })} />
            </div>
            <div style={{ flex: "2 1 220px" }}>
              <label style={ui.label}>Abertura das vagas</label>
              <input type="datetime-local" style={{ ...ui.input, marginBottom: 4 }} value={paraCampo(editando.vagas_abrem_em)}
                onChange={(ev) => setEditando({ ...editando, vagas_abrem_em: doCampo(ev.target.value) })} />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--p-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
            Vagas em branco = sem limite. Abertura em branco = vagas já abertas. Quando lotar, as vagas fecham sozinhas e os próximos entram na fila de espera;
            se alguém cancelar, o 1º da fila entra automaticamente e recebe aviso no WhatsApp. Quem pediu "me avise" recebe mensagem na hora da abertura.
          </div>
          <label style={ui.label}>Vídeo do evento (aparece depois que o evento acontece)</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input style={{ ...ui.input, flex: 1 }} placeholder="Link do YouTube, do Drive ou envie o arquivo" value={editando.video_url || ""} onChange={(ev) => setEditando({ ...editando, video_url: ev.target.value })} />
            <label style={{ ...ui.botaoSecundario, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
              {enviandoVideo === "video_url" ? "Enviando..." : "Enviar .mp4"}
              <input type="file" accept="video/mp4,video/webm" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) enviarVideo(f, "video_url"); ev.target.value = ""; }} />
            </label>
          </div>
          <label style={ui.label}>Trecho curto que fica rodando no card (opcional)</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <input style={{ ...ui.input, flex: 1 }} placeholder="Se vazio, usa o próprio vídeo" value={editando.video_previa_url || ""} onChange={(ev) => setEditando({ ...editando, video_previa_url: ev.target.value })} />
            <label style={{ ...ui.botaoSecundario, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
              {enviandoVideo === "video_previa_url" ? "Enviando..." : "Enviar .mp4"}
              <input type="file" accept="video/mp4,video/webm" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) enviarVideo(f, "video_previa_url"); ev.target.value = ""; }} />
            </label>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--p-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
            Arquivo até 50 MB. Para o card ficar leve, o ideal é um trecho de 10 a 20 segundos, sem som.
          </div>
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
  const [fila, setFila] = useState<{ id: number; evento_id: string; tipo: string; criado_em: string; nome: string }[]>([]);
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
    const [{ data: fl }, { data: ms }] = await Promise.all([
      supabase.from("eventos_lista").select("id,evento_id,tipo,criado_em,user_id").order("criado_em"),
      supabase.from("membros").select("nome,auth_user_id").not("auth_user_id", "is", null),
    ]);
    const nomes: Record<string, string> = {};
    (ms || []).forEach((m: { nome: string; auth_user_id: string }) => { nomes[m.auth_user_id] = m.nome; });
    setFila((fl || []).map((l: { id: number; evento_id: string; tipo: string; criado_em: string; user_id: string }) => ({ ...l, nome: nomes[l.user_id] || "Membro" })));
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
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--p-accent)", marginBottom: 10 }}>{visiveis.length} presença(s) confirmada(s)</div>
      {carregando ? <div style={ui.aviso}>Carregando...</div> : visiveis.length === 0 ? <div style={ui.aviso}>Ninguém confirmou presença neste evento ainda.</div> : visiveis.map((p) => (
        <div key={p.id} style={{ ...ui.cartao, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontWeight: 700 }}>{p.membro}</div>
            <div style={{ fontSize: 13, color: "var(--p-muted)" }}>{p.membro_login} · confirmado em {dataCurta(p.confirmado_em)}</div>
            {eventoId === "todos" && <div style={{ fontSize: 12, color: "var(--p-accent)", fontWeight: 700, marginTop: 2 }}>{nomeEvento(p.evento_id)}</div>}
          </div>
          <button style={ui.botaoPerigo} onClick={() => remover(p)}>Remover</button>
        </div>
      ))}
      {eventoId !== "todos" && ["fila", "aviso"].map((tipo) => {
        const lista = fila.filter((l) => l.evento_id === eventoId && l.tipo === tipo);
        if (!lista.length) return null;
        return (
          <div key={tipo} style={{ marginTop: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: tipo === "fila" ? "var(--p-warn)" : "var(--p-muted)", marginBottom: 10 }}>
              {tipo === "fila" ? `Fila de espera (${lista.length}) · entram nesta ordem quando abrir vaga` : `Pediram aviso da abertura (${lista.length})`}
            </div>
            {lista.map((l, i) => (
              <div key={l.id} style={{ ...ui.cartao, padding: "10px 18px", display: "flex", gap: 12, alignItems: "center" }}>
                {tipo === "fila" && <strong style={{ color: "var(--p-warn)" }}>{i + 1}º</strong>}
                <span style={{ fontWeight: 600 }}>{l.nome}</span>
                <span style={{ fontSize: 13, color: "var(--p-muted)", marginLeft: "auto" }}>{dataCurta(l.criado_em)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </main>
  );
}

/* ------------------------------------------------------------------ */

const chip: CSSProperties = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, marginLeft: 8, verticalAlign: "middle" };

function Modal({ titulo, onFechar, children, largura = 460 }: { titulo: string; onFechar: () => void; children: React.ReactNode; largura?: number }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,34,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div style={{ background: "linear-gradient(180deg,var(--p-card) 0%,var(--p-card) 100%)", borderRadius: 18, padding: "28px 24px", maxWidth: largura, width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button onClick={onFechar} aria-label="Fechar" style={{ position: "absolute", top: 12, right: 14, border: "none", background: "none", fontSize: 26, color: "var(--p-muted)", cursor: "pointer" }}>×</button>
        <h2 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 18px", color: "var(--p-text)" }}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

function Caixa({ marcado, onChange, texto }: { marcado: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--p-text)", margin: "6px 0 12px", cursor: "pointer" }}>
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--p-accent)" }} />
      {texto}
    </label>
  );
}
