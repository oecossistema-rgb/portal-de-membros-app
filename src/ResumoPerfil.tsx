import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

// Resumo do perfil da empresa, escrito pela IA a partir do onboarding (sem dados sensíveis)
// e aprovado por um administrador antes de aparecer para os outros membros.
export type Resumo = {
  apresentacao: string;
  o_que_faz: string;
  pontos_fortes: string[];
  oportunidades: string[];
  como_contribui: string;
  interesses: string;
};

export const RESUMO_VAZIO: Resumo = { apresentacao: "", o_que_faz: "", pontos_fortes: [], oportunidades: [], como_contribui: "", interesses: "" };

const titulo: CSSProperties = { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#6B8E23", fontWeight: 800, margin: "14px 0 4px" };
const corpo: CSSProperties = { fontSize: 15, color: "#1A1F2B", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" };

// Exibição (diretório, Meu Perfil e pré-visualização do administrador).
export function CartaoResumo({ resumo }: { resumo: Resumo }) {
  return (
    <div style={{ textAlign: "left" }}>
      {resumo.apresentacao && <p style={{ ...corpo, fontSize: 16 }}>{resumo.apresentacao}</p>}
      {resumo.o_que_faz && (<><div style={titulo}>O que faz</div><p style={corpo}>{resumo.o_que_faz}</p></>)}
      {resumo.pontos_fortes?.length > 0 && (
        <><div style={titulo}>Pontos fortes</div>
          <ul style={{ ...corpo, paddingLeft: 20 }}>{resumo.pontos_fortes.map((x) => <li key={x}>{x}</li>)}</ul></>
      )}
      {resumo.oportunidades?.length > 0 && (
        <><div style={titulo}>Oportunidades de conexão</div>
          <ul style={{ ...corpo, paddingLeft: 20 }}>{resumo.oportunidades.map((x) => <li key={x}>{x}</li>)}</ul></>
      )}
      {resumo.como_contribui && (<><div style={titulo}>Como contribui com o grupo</div><p style={corpo}>{resumo.como_contribui}</p></>)}
      {resumo.interesses && (<><div style={titulo}>Interesses</div><p style={corpo}>{resumo.interesses}</p></>)}
    </div>
  );
}

type Rascunho = { status: string; rascunho: Resumo | null; alertas: string[] | null; erro: string | null; gerado_em: string | null };

const STATUS: Record<string, { texto: string; cor: string; fundo: string }> = {
  aprovado: { texto: "Publicado para os membros", cor: "#4A6118", fundo: "#E8F0D8" },
  pendente: { texto: "Aguardando sua aprovação", cor: "#8A6D1A", fundo: "#FBF3DC" },
  gerando: { texto: "Gerando...", cor: "#45505F", fundo: "#EAECEF" },
  erro: { texto: "Erro ao gerar", cor: "#9A3B3B", fundo: "#F7E4E4" },
};

// Área do administrador: gerar, revisar/editar, aprovar e retirar o resumo de um membro.
export function RevisaoResumo({ membroId, onAlterado }: { membroId: string; onAlterado?: () => void }) {
  const [r, setR] = useState<Rascunho | null>(null);
  const [texto, setTexto] = useState<Resumo>(RESUMO_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from("membros_resumo").select("status,rascunho,alertas,erro,gerado_em").eq("membro_id", membroId).maybeSingle();
    setR((data as Rascunho) || null);
    setTexto({ ...RESUMO_VAZIO, ...(data?.rascunho as Resumo) });
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
    else setMsg({ tipo: "ok", texto: "Resumo gerado. Revise e aprove para publicar." });
    await carregar(); onAlterado?.();
  }

  async function aprovar() {
    setOcupado("aprovar"); setMsg(null);
    const limpo: Resumo = {
      ...texto,
      pontos_fortes: texto.pontos_fortes.map((x) => x.trim()).filter(Boolean),
      oportunidades: texto.oportunidades.map((x) => x.trim()).filter(Boolean),
    };
    const { error } = await supabase.rpc("publicar_resumo", { p_membro: membroId, p_resumo: limpo });
    setOcupado("");
    setMsg(error ? { tipo: "erro", texto: "Não foi possível publicar." } : { tipo: "ok", texto: "Resumo publicado no perfil do membro." });
    await carregar(); onAlterado?.();
  }

  async function retirar() {
    setOcupado("retirar"); setMsg(null);
    const { error } = await supabase.rpc("retirar_resumo", { p_membro: membroId });
    setOcupado("");
    setMsg(error ? { tipo: "erro", texto: "Não foi possível retirar." } : { tipo: "ok", texto: "Resumo retirado do perfil. Ele voltou para revisão." });
    await carregar(); onAlterado?.();
  }

  if (carregando) return <div style={ui.aviso}>Carregando resumo...</div>;
  const st = r ? STATUS[r.status] : null;
  const campoLista = (chave: "pontos_fortes" | "oportunidades", rotulo: string) => (
    <div style={{ marginBottom: 12 }}>
      <label style={ui.label}>{rotulo} (um por linha)</label>
      <textarea style={{ ...ui.input, minHeight: 80 }} value={texto[chave].join("\n")}
        onChange={(e) => setTexto({ ...texto, [chave]: e.target.value.split("\n") })} />
    </div>
  );
  const campo = (chave: "apresentacao" | "o_que_faz" | "como_contribui" | "interesses", rotulo: string) => (
    <div style={{ marginBottom: 12 }}>
      <label style={ui.label}>{rotulo}</label>
      <textarea style={{ ...ui.input, minHeight: chave === "apresentacao" ? 90 : 56 }} value={texto[chave]}
        onChange={(e) => setTexto({ ...texto, [chave]: e.target.value })} />
    </div>
  );

  return (
    <div style={{ textAlign: "left" }}>
      <p style={{ fontSize: 13, color: "#5A6472", margin: "0 0 12px" }}>
        Escrito pela IA a partir do onboarding, sem faturamento, metas, limitações ou desafios. Só aparece para os outros membros depois que você aprovar.
      </p>
      {st && <div style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: st.cor, background: st.fundo, borderRadius: 100, padding: "5px 12px", marginBottom: 12 }}>{st.texto}</div>}
      {r?.status === "erro" && r.erro && <div style={ui.erro}>Motivo: {r.erro}</div>}
      {r?.alertas && r.alertas.length > 0 && r.status !== "aprovado" && (
        <div style={ui.erro}>Atenção, revise antes de aprovar. O texto pode conter: {r.alertas.join(", ")}.</div>
      )}
      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}

      {r?.rascunho ? (
        <>
          {campo("apresentacao", "Apresentação")}
          {campo("o_que_faz", "O que faz")}
          {campoLista("pontos_fortes", "Pontos fortes")}
          {campoLista("oportunidades", "Oportunidades de conexão")}
          {campo("como_contribui", "Como contribui com o grupo")}
          {campo("interesses", "Interesses")}
        </>
      ) : (
        <div style={{ ...ui.aviso, marginBottom: 12 }}>Ainda não há resumo para este membro.</div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {r?.rascunho && r.status !== "aprovado" && (
          <button className="cta-btn" style={ui.botao} onClick={aprovar} disabled={!!ocupado}>{ocupado === "aprovar" ? "Publicando..." : "Aprovar e publicar"}</button>
        )}
        {r?.rascunho && r.status === "aprovado" && (
          <button className="cta-btn" style={ui.botao} onClick={aprovar} disabled={!!ocupado}>{ocupado === "aprovar" ? "Salvando..." : "Salvar alterações publicadas"}</button>
        )}
        <button style={ui.botaoSecundario} onClick={gerar} disabled={!!ocupado}>
          {ocupado === "gerar" ? "Gerando (até 30 s)..." : r?.rascunho ? "Gerar novamente" : "Gerar resumo"}
        </button>
        {r?.status === "aprovado" && <button style={ui.botaoPerigo} onClick={retirar} disabled={!!ocupado}>Retirar do perfil</button>}
      </div>
    </div>
  );
}
