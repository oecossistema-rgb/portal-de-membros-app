// Fase 2 · Etapa 1 (28/11/2026): Acessos da equipe.
// "Equipe e setores": quem é da equipe, em qual setor, e o que cada setor pode ver/editar em cada área.
// "Registro de atividades": tudo o que foi criado, alterado ou apagado no portal — quem, quando, antes e depois.
// Estrutura pronta e desligada: hoje só administradores entram na Administração (Diretoria = vê tudo).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Setor = { id: string; nome: string; ordem: number };
type Perm = { setor: string; area: string; nivel: "nenhum" | "ver" | "editar" };
type Pessoa = { id: string; nome: string; empresa: string | null; is_admin: boolean; equipe: boolean; setor: string | null; foto_url: string | null };
type Registro = { id: number; quando: string; quem_nome: string | null; origem: string; acao: string; tabela: string; registro_nome: string | null; mudancas: Record<string, unknown> | null };

export const AREAS: { id: string; nome: string }[] = [
  { id: "visao", nome: "Painel geral" }, { id: "saude", nome: "Saúde do sistema" }, { id: "membros", nome: "Membros (cadastro)" },
  { id: "carteiras", nome: "Carteiras e mentores" }, { id: "jornada", nome: "Jornada do membro" }, { id: "reunioes", nome: "Reuniões" },
  { id: "conversas", nome: "Conversas (WhatsApp)" }, { id: "disparos", nome: "Disparos" }, { id: "indicacoes", nome: "Indicações" },
  { id: "cashback_valores", nome: "Cashback (valores)" }, { id: "ofertas", nome: "Ofertas" }, { id: "pesquisas", nome: "Pesquisas" },
  { id: "pedidos_ajuda", nome: "Pedidos de ajuda" }, { id: "eventos", nome: "Eventos e presenças" }, { id: "conteudo", nome: "Conteúdo" },
  { id: "contratos", nome: "Contratos" }, { id: "acessos", nome: "Acessos da equipe" }, { id: "registro", nome: "Registro de atividades" },
];
const TABELAS: Record<string, string> = {
  membros: "Membro", contratos: "Contrato", eventos: "Evento", ofertas: "Oferta", wa_disparos: "Disparo de WhatsApp", wa_modelos: "Modelo de mensagem",
  portal_config: "Configuração", solicitacoes_acesso: "Pedido de acesso", conteudos: "Conteúdo", equipe_setores: "Setor", equipe_permissoes: "Permissão",
};
// Nome amigável dos campos no registro (o resto vira texto com espaços).
const CAMPO: Record<string, string> = {
  nome: "nome", titulo: "título", data_inicio: "data", hora_inicio: "horário", local: "local", status: "situação", empresa: "empresa",
  telefone_whatsapp: "WhatsApp", email: "e-mail", foto_url: "foto", logo_url: "logo", ativo: "ativo", is_admin: "administrador",
  setor: "setor", nivel: "nível", valor: "valor", descricao: "descrição", preco: "preço", segmento: "segmento", vagas: "vagas",
  agendado_para: "agendado para", vigencia_fim: "fim da vigência", vigencia_inicio: "início da vigência", contrato_pendente: "contrato pendente",
};
const campoNome = (k: string) => CAMPO[k] || k.replace(/_/g, " ");
const NIVEL_COR: Record<string, string> = { nenhum: "var(--p-muted)", ver: "#B26A00", editar: "var(--p-accent-text)" };
const NIVEL_ROT: Record<string, string> = { nenhum: "Não vê", ver: "Só vê", editar: "Vê e edita" };

export function AdminAcessos() {
  const [sub, setSub] = useState<"equipe" | "registro">("equipe");
  return (
    <div style={ui.largo}>
      <div style={{ ...ui.cartao, padding: "14px 18px", fontSize: 14, color: "var(--p-text2)" }}>
        <b style={{ color: "var(--p-text)" }}>Estrutura pronta, ainda desligada.</b> Hoje só os administradores (Diretoria) entram na Administração e veem tudo.
        Quando decidirem liberar um setor, basta colocar a pessoa no setor: ela passa a ver só as áreas marcadas para ele.
      </div>
      <div style={{ display: "flex", gap: 8, margin: "4px 0 14px" }}>
        {([["equipe", "Equipe e setores"], ["registro", "Registro de atividades"]] as const).map(([id, r]) => (
          <button key={id} onClick={() => setSub(id)} style={{ ...ui.botaoSecundario, ...(sub === id ? { background: "var(--p-accent-bg)", borderColor: "var(--p-accent)", color: "var(--p-accent-text)", fontWeight: 600 } : {}) }}>{r}</button>
        ))}
      </div>
      {sub === "equipe" ? <EquipeSetores /> : <RegistroAtividades />}
    </div>
  );
}

function EquipeSetores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [setorAberto, setSetorAberto] = useState<string>("relacionamento");
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function carregar() {
    const [s, p, m] = await Promise.all([
      supabase.from("equipe_setores").select("*").order("ordem"),
      supabase.from("equipe_permissoes").select("*"),
      supabase.from("membros").select("id,nome,empresa,is_admin,equipe,setor,foto_url").eq("ativo", true).order("nome"),
    ]);
    setSetores((s.data as Setor[]) || []); setPerms((p.data as Perm[]) || []); setPessoas((m.data as Pessoa[]) || []);
  }
  useEffect(() => { carregar(); }, []);

  const equipe = pessoas.filter((p) => p.is_admin || p.setor);
  const candidatos = useMemo(() => busca.trim().length < 2 ? [] : pessoas.filter((p) => !p.is_admin && !p.setor && p.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 6), [busca, pessoas]);
  const nivel = (setor: string, area: string) => perms.find((x) => x.setor === setor && x.area === area)?.nivel || "nenhum";

  async function mudarSetor(p: Pessoa, setor: string | null) {
    const { error } = await supabase.from("membros").update({ setor }).eq("id", p.id);
    setMsg(error ? `Não foi possível salvar: ${error.message}` : setor ? `${p.nome} agora está no setor ${setores.find((s) => s.id === setor)?.nome}.` : `${p.nome} saiu da equipe.`);
    setBusca(""); carregar();
  }
  async function mudarNivel(setor: string, area: string, n: Perm["nivel"]) {
    const { error } = await supabase.from("equipe_permissoes").upsert({ setor, area, nivel: n }, { onConflict: "setor,area" });
    if (error) setMsg(`Não foi possível salvar: ${error.message}`);
    carregar();
  }

  return (
    <>
      {msg && <div style={{ ...ui.ok, marginBottom: 12 }}>{msg}</div>}
      <section style={ui.cartao}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Pessoas da equipe</div>
        <div style={{ fontSize: 13, color: "var(--p-muted)", marginBottom: 14 }}>Cada pessoa tem um setor. Administrador vê tudo, independente do setor.</div>
        {equipe.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--p-line)", flexWrap: "wrap" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: p.foto_url ? `center/cover url(${p.foto_url})` : "var(--p-accent-bg)", flex: "none" }} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{p.nome}</div>
              <div style={{ fontSize: 12, color: "var(--p-muted)" }}>{p.is_admin ? "Administrador · vê tudo" : "Acesso pelo setor"}</div>
            </div>
            <select value={p.setor || ""} onChange={(e) => mudarSetor(p, e.target.value || null)} style={{ ...ui.input, width: 230 }} aria-label={`Setor de ${p.nome}`}>
              {!p.is_admin && <option value="">Sem setor (sai da equipe)</option>}
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--p-line)", paddingTop: 14, marginTop: 4 }}>
          <label style={ui.label}>Adicionar pessoa à equipe (precisa ter cadastro no portal)</label>
          <input style={ui.input} placeholder="Digite o nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {candidatos.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <span style={{ flex: 1 }}>{p.nome}{p.empresa ? <span style={{ color: "var(--p-muted)" }}> · {p.empresa}</span> : null}</span>
              <select defaultValue="" onChange={(e) => e.target.value && mudarSetor(p, e.target.value)} style={{ ...ui.input, width: 200 }}>
                <option value="">Escolher setor…</option>
                {setores.filter((s) => s.id !== "diretoria").map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section style={ui.cartao}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>O que cada setor pode fazer</div>
        <div style={{ fontSize: 13, color: "var(--p-muted)", marginBottom: 12 }}>Escolha o setor e defina, para cada área, se ele não vê, só vê ou vê e edita. Os dados sensíveis (valores, contratos, onboarding) seguem estas regras também no banco.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {setores.map((s) => (
            <button key={s.id} onClick={() => setSetorAberto(s.id)} style={{ ...ui.botaoSecundario, padding: "6px 12px", ...(setorAberto === s.id ? { background: "var(--p-accent)", color: "var(--p-on-accent)", borderColor: "transparent" } : {}) }}>{s.nome}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8 }}>
          {AREAS.map((a) => {
            const n = nivel(setorAberto, a.id);
            const travado = setorAberto === "diretoria";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--p-line)", borderRadius: 12, padding: "8px 10px" }}>
                <span style={{ flex: 1, fontSize: 14 }}>{a.nome}</span>
                <select value={n} disabled={travado} onChange={(e) => mudarNivel(setorAberto, a.id, e.target.value as Perm["nivel"])}
                  style={{ ...ui.input, width: 120, padding: "6px 8px", fontSize: 13, color: NIVEL_COR[n], fontWeight: 600 }} aria-label={`${a.nome}: nível`}>
                  {(["nenhum", "ver", "editar"] as const).map((x) => <option key={x} value={x}>{NIVEL_ROT[x]}</option>)}
                </select>
              </div>
            );
          })}
        </div>
        {setorAberto === "diretoria" && <div style={{ fontSize: 12, color: "var(--p-muted)", marginTop: 8 }}>A Diretoria vê e edita tudo (fixo).</div>}
      </section>
    </>
  );
}

function RegistroAtividades() {
  const [itens, setItens] = useState<Registro[]>([]);
  const [tabela, setTabela] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [limite, setLimite] = useState(50);

  useEffect(() => {
    let q = supabase.from("registro_atividades").select("*").order("quando", { ascending: false }).limit(limite);
    if (tabela) q = q.eq("tabela", tabela);
    if (busca.trim()) q = q.or(`quem_nome.ilike.%${busca.trim()}%,registro_nome.ilike.%${busca.trim()}%`);
    q.then(({ data }) => setItens((data as Registro[]) || []));
  }, [tabela, busca, limite]);

  const quando = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const campos = (m: Record<string, unknown> | null) => Object.keys(m || {});

  return (
    <section style={ui.cartao}>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Registro de atividades</div>
      <div style={{ fontSize: 13, color: "var(--p-muted)", marginBottom: 12 }}>Tudo o que é criado, alterado ou apagado no portal fica aqui, com quem fez e o que mudou. Ninguém consegue apagar este registro.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input style={{ ...ui.input, flex: 1, minWidth: 200 }} placeholder="Buscar por pessoa ou item…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select style={{ ...ui.input, width: 220 }} value={tabela} onChange={(e) => setTabela(e.target.value)}>
          <option value="">Tudo</option>
          {Object.entries(TABELAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {itens.length === 0 && <div style={{ color: "var(--p-muted)", fontSize: 14, padding: "12px 0" }}>Nenhuma atividade registrada ainda.</div>}
      {itens.map((r) => (
        <div key={r.id} style={{ borderTop: "1px solid var(--p-line)", padding: "10px 0" }}>
          <button onClick={() => setAberto(aberto === r.id ? null : r.id)} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 10, width: "100%", alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--p-muted)", width: 86, flex: "none" }}>{quando(r.quando)}</span>
            <span style={{ flex: 1, minWidth: 200, fontSize: 14 }}>
              <b>{r.quem_nome || "Sistema (automático)"}</b> {r.acao} {TABELAS[r.tabela]?.toLowerCase() || r.tabela}
              {r.registro_nome ? <> <b>“{r.registro_nome}”</b></> : null}
              {r.acao === "alterou" && campos(r.mudancas).length > 0 && <span style={{ color: "var(--p-muted)" }}> · {campos(r.mudancas).map(campoNome).join(", ")}</span>}
            </span>
          </button>
          {aberto === r.id && r.mudancas && (
            <div style={{ marginTop: 8, marginLeft: 96, fontSize: 13, background: "var(--p-card2, var(--p-bg))", borderRadius: 10, padding: "8px 12px" }}>
              {Object.entries(r.mudancas).map(([k, v]) => {
                const ad = v as { antes?: string; depois?: string } | string;
                return (
                  <div key={k} style={{ padding: "3px 0" }}>
                    <b>{campoNome(k)}</b>: {typeof ad === "object" && ad ? <><span style={{ color: "var(--p-danger)", textDecoration: "line-through" }}>{ad.antes ?? "—"}</span> → <span style={{ color: "var(--p-accent-text)" }}>{ad.depois ?? "—"}</span></> : String(ad)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      {itens.length >= limite && <button style={{ ...ui.botaoSecundario, marginTop: 10 }} onClick={() => setLimite(limite + 50)}>Ver mais</button>}
    </section>
  );
}
