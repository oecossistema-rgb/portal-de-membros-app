// Solicitações de acesso em aberto: quem criou a senha e o portal não reconheceu como membro.
// "É ele" liga o login ao perfil que já existe (sem duplicar); "Aprovar como novo" cria um cadastro;
// em ambos a pessoa recebe o cartão no WhatsApp. Recusar só fecha o pedido.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Sol = {
  id: string; nome: string; email: string; whatsapp: string | null; empresa: string | null; status: string;
  criado_em: string; decidido_em: string | null; whatsapp_enviado_em: string | null; whatsapp_erro: string | null;
};

const fone = (d: string | null) => {
  if (!d) return "";
  const n = d.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : d;
};
const quando = (t: string) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Candidato = { id: string; nome: string; empresa: string | null; email: string | null; fone_final: string | null };

// Sem acento, minúsculo, só letras e números.
const norm = (t: string | null | undefined) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
const PREP = new Set(["da", "de", "do", "das", "dos", "e"]);
const palavras = (t: string | null | undefined) => norm(t).split(/\s+/).filter((p) => p.length > 1 && !PREP.has(p));

// Pontua o quanto um membro sem login parece com quem pediu acesso.
export function pontuar(s: { nome: string; email: string; whatsapp: string | null; empresa: string | null }, c: Candidato): number {
  let p = 0;
  if (c.email && norm(c.email) === norm(s.email)) p += 10;
  const fs = (s.whatsapp || "").replace(/\D/g, "");
  if (c.fone_final && fs.length >= 10 && fs.endsWith(c.fone_final)) p += 4;
  const ns = palavras(s.nome), nc = palavras(c.nome);
  if (ns[0] && nc[0] && ns[0] === nc[0]) p += 3;
  p += ns.slice(1).filter((w) => nc.slice(1).includes(w)).length * 2;
  const es = palavras(s.empresa), ec = palavras(c.empresa);
  if (es.length && ec.length && es.some((w) => w.length > 2 && ec.includes(w))) p += 3;
  return p;
}
const MINIMO = 5;

export async function contarSolicitacoes(): Promise<number> {
  const { count } = await supabase.from("solicitacoes_acesso").select("id", { count: "exact", head: true }).eq("status", "pendente");
  return count || 0;
}

export default function Solicitacoes({ onMudou }: { onMudou?: () => void }) {
  const [lista, setLista] = useState<Sol[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [cands, setCands] = useState<Candidato[]>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});

  async function carregar() {
    // Pendentes + aprovações recentes cujo WhatsApp falhou (para reenviar).
    const { data } = await supabase.from("solicitacoes_acesso")
      .select("id,nome,email,whatsapp,empresa,status,criado_em,decidido_em,whatsapp_enviado_em,whatsapp_erro")
      .or("status.eq.pendente,and(status.eq.aprovada,whatsapp_enviado_em.is.null,whatsapp.not.is.null)")
      .order("criado_em", { ascending: true });
    setLista((data as Sol[]) || []);
    const { data: c } = await supabase.rpc("membros_para_vincular");
    setCands((c as Candidato[]) || []);
  }
  useEffect(() => { carregar(); }, []);

  async function decidir(s: Sol, acao: "aprovar" | "recusar" | "reenviar" | "vincular", membro?: Candidato) {
    const primeiro = s.nome.split(" ")[0];
    if (acao === "vincular" && membro && !confirm(`Ligar o acesso de ${s.email} ao cadastro de ${membro.nome}? Ele entra com o perfil, resumo e oportunidades que já existem.`)) return;
    if (acao === "recusar" && !confirm(`Recusar o acesso de ${s.nome}? Nenhuma mensagem é enviada.`)) return;
    if (acao === "aprovar" && !confirm(`Criar um cadastro NOVO para ${s.nome}? Se ele já é membro, use "É ele" ou escolha o nome na lista, para não duplicar.`)) return;
    if (acao === "aprovar" && !s.whatsapp &&!confirm(`${s.nome} ainda não informou o WhatsApp. Aprovar mesmo assim? Ele não vai receber o aviso, mas já consegue entrar.`)) return;
    setOcupado(s.id); setMsg(null);
    const { data, error } = await supabase.functions.invoke("decidir-acesso", { body: { id: s.id, acao, membro_id: membro?.id } });
    setOcupado(null);
    if (error || !data?.ok) {
      // Mostra o motivo que a função devolveu (em português), em vez da mensagem técnica genérica.
      let motivo = data?.erro as string | undefined;
      try { const ctx = (error as { context?: Response } | null)?.context; if (!motivo && ctx) motivo = (await ctx.json())?.erro; } catch { /* sem corpo */ }
      setMsg({ tipo: "erro", texto: `Não foi possível concluir${motivo ? `: ${motivo}` : ". Tente de novo em instantes; se continuar, avise o suporte."}` });
    } else if (acao === "recusar") {
      setMsg({ tipo: "ok", texto: `Solicitação de ${primeiro} recusada.` });
    } else if (data.whatsapp === "sem_numero") {
      setMsg({ tipo: "ok", texto: `${primeiro} aprovado. Como não informou WhatsApp, não recebeu aviso: avise por outro canal que o acesso está liberado.` });
    } else if (data.whatsapp === "enviado") {
      setMsg({ tipo: "ok", texto: acao === "vincular" ? `${primeiro} ligado ao cadastro de ${membro?.nome} e avisado no WhatsApp.` : acao === "aprovar" ? `${primeiro} aprovado e avisado no WhatsApp. No primeiro acesso, ele preenche o onboarding.` : `WhatsApp reenviado para ${primeiro}.` });
    } else {
      setMsg({ tipo: "erro", texto: `${acao !== "reenviar" ? `${primeiro} foi aprovado, mas o` : "O"} WhatsApp não saiu (${data.whatsapp_erro}). Use "Reenviar WhatsApp" depois.` });
    }
    await carregar(); onMudou?.();
  }

  if (!lista || lista.length === 0) return null;
  const pend = lista.filter((s) => s.status === "pendente");
  return (
    <section style={{ ...ui.cartao, borderColor: "var(--p-accent)", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--p-accent)", boxShadow: "0 0 0 4px var(--p-accent-bg)" }} />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--p-text)" }}>
          {pend.length ? `${pend.length} ${pend.length === 1 ? "solicitação de acesso" : "solicitações de acesso"} em aberto` : "Avisos de WhatsApp pendentes"}
        </h2>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--p-muted)" }}>
        Pessoas que criaram a senha e o portal não reconheceu como membro. Se for alguém que já está no cadastro, use <strong>É ele</strong>: o acesso é ligado ao perfil que já existe, sem duplicar. Em todos os casos, a pessoa recebe o cartão de boas-vindas no WhatsApp.
      </p>
      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, background: "var(--p-card2)", border: "1px solid var(--p-line)" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--p-text)" }}>{s.nome}{s.empresa && <span style={{ fontWeight: 400, color: "var(--p-muted)" }}> · {s.empresa}</span>}</div>
              <div style={{ fontSize: 13, color: "var(--p-muted)", marginTop: 3, overflowWrap: "anywhere" }}>
                {s.email} · {s.whatsapp ? `WhatsApp ${fone(s.whatsapp)}` : "WhatsApp ainda não informado"} · pediu em {quando(s.criado_em)}
              </div>
              {s.status === "pendente" && !s.whatsapp && <div style={{ fontSize: 12.5, color: "var(--p-warn)", marginTop: 4 }}>Criou a conta, mas ainda não completou WhatsApp e empresa. Se aprovar agora, a pessoa não recebe o aviso no WhatsApp.</div>}
              {s.status === "aprovada" && <div style={{ fontSize: 12.5, color: "var(--p-danger)", marginTop: 4 }}>Aprovado, mas o WhatsApp não saiu: {s.whatsapp_erro || "sem resposta"}</div>}
            </div>
            {s.status === "pendente" ? (() => {
              const ranking = cands.map((c) => ({ c, p: pontuar(s, c) })).sort((a, b) => b.p - a.p);
              const sugerido = ranking[0] && ranking[0].p >= MINIMO ? ranking[0].c : null;
              const outroId = escolha[s.id] || "";
              const outro = cands.find((c) => c.id === outroId);
              return (
                <div style={{ flex: "1 1 100%", display: "flex", flexDirection: "column", gap: 10 }}>
                  {sugerido && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: 12, background: "var(--p-accent-bg)" }}>
                      <span style={{ flex: "1 1 200px", fontSize: 14, color: "var(--p-text)" }}>
                        Parece ser <strong>{sugerido.nome}</strong>{sugerido.empresa ? ` · ${sugerido.empresa}` : ""}, já cadastrado.
                      </span>
                      <button style={ui.botao} disabled={!!ocupado} onClick={() => decidir(s, "vincular", sugerido)}>{ocupado === s.id ? "Aguarde..." : "É ele"}</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select aria-label="Ligar a outro membro" value={outroId} onChange={(e) => setEscolha({ ...escolha, [s.id]: e.target.value })}
                      style={{ flex: "1 1 220px", minWidth: 0, padding: "9px 10px", borderRadius: 10, border: "1px solid var(--p-line2)", background: "var(--p-field)", color: "var(--p-text)", fontSize: 14 }}>
                      <option value="">{sugerido ? "Não é? Escolher outro membro…" : "É um membro já cadastrado? Escolha…"}</option>
                      {ranking.map(({ c }) => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` · ${c.empresa}` : ""}</option>)}
                    </select>
                    {outro && <button style={ui.botao} disabled={!!ocupado} onClick={() => decidir(s, "vincular", outro)}>Ligar a {outro.nome.split(" ")[0]}</button>}
                    <button style={ui.botaoSecundario} disabled={!!ocupado} onClick={() => decidir(s, "aprovar")}>Aprovar como novo</button>
                    <button style={ui.botaoPerigo} disabled={!!ocupado} onClick={() => decidir(s, "recusar")}>Recusar</button>
                  </div>
                </div>
              );
            })() : (
              <button style={ui.botaoSecundario} disabled={!!ocupado} onClick={() => decidir(s, "reenviar")}>{ocupado === s.id ? "Aguarde..." : "Reenviar WhatsApp"}</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
