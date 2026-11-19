// Solicitações de acesso em aberto: quem criou a senha sem estar pré-cadastrado e pediu para entrar.
// Aprovar cria o cadastro de membro e envia um WhatsApp avisando; recusar só fecha o pedido.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Sol = {
  id: string; nome: string; email: string; whatsapp: string; empresa: string; status: string;
  criado_em: string; decidido_em: string | null; whatsapp_enviado_em: string | null; whatsapp_erro: string | null;
};

const fone = (d: string) => {
  const n = d.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : d;
};
const quando = (t: string) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export async function contarSolicitacoes(): Promise<number> {
  const { count } = await supabase.from("solicitacoes_acesso").select("id", { count: "exact", head: true }).eq("status", "pendente");
  return count || 0;
}

export default function Solicitacoes({ onMudou }: { onMudou?: () => void }) {
  const [lista, setLista] = useState<Sol[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    // Pendentes + aprovações recentes cujo WhatsApp falhou (para reenviar).
    const { data } = await supabase.from("solicitacoes_acesso")
      .select("id,nome,email,whatsapp,empresa,status,criado_em,decidido_em,whatsapp_enviado_em,whatsapp_erro")
      .or("status.eq.pendente,and(status.eq.aprovada,whatsapp_enviado_em.is.null)")
      .order("criado_em", { ascending: true });
    setLista((data as Sol[]) || []);
  }
  useEffect(() => { carregar(); }, []);

  async function decidir(s: Sol, acao: "aprovar" | "recusar" | "reenviar") {
    const primeiro = s.nome.split(" ")[0];
    if (acao === "recusar" && !confirm(`Recusar o acesso de ${s.nome}? Nenhuma mensagem é enviada.`)) return;
    setOcupado(s.id); setMsg(null);
    const { data, error } = await supabase.functions.invoke("decidir-acesso", { body: { id: s.id, acao } });
    setOcupado(null);
    if (error || !data?.ok) {
      // Mostra o motivo que a função devolveu (em português), em vez da mensagem técnica genérica.
      let motivo = data?.erro as string | undefined;
      try { const ctx = (error as { context?: Response } | null)?.context; if (!motivo && ctx) motivo = (await ctx.json())?.erro; } catch { /* sem corpo */ }
      setMsg({ tipo: "erro", texto: `Não foi possível concluir${motivo ? `: ${motivo}` : ". Tente de novo em instantes; se continuar, avise o suporte."}` });
    } else if (acao === "recusar") {
      setMsg({ tipo: "ok", texto: `Solicitação de ${primeiro} recusada.` });
    } else if (data.whatsapp === "enviado") {
      setMsg({ tipo: "ok", texto: acao === "aprovar" ? `${primeiro} aprovado e avisado no WhatsApp. No primeiro acesso, ele preenche o onboarding.` : `WhatsApp reenviado para ${primeiro}.` });
    } else {
      setMsg({ tipo: "erro", texto: `${acao === "aprovar" ? `${primeiro} foi aprovado, mas o` : "O"} WhatsApp não saiu (${data.whatsapp_erro}). Use "Reenviar WhatsApp" depois.` });
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
        Pessoas que criaram a senha sem estar pré-cadastradas. Ao aprovar, o cadastro é criado e ela recebe um WhatsApp com o link do portal.
      </p>
      {msg && <div style={msg.tipo === "ok" ? ui.ok : ui.erro}>{msg.texto}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, background: "var(--p-card2)", border: "1px solid var(--p-line)" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--p-text)" }}>{s.nome} <span style={{ fontWeight: 400, color: "var(--p-muted)" }}>· {s.empresa}</span></div>
              <div style={{ fontSize: 13, color: "var(--p-muted)", marginTop: 3, overflowWrap: "anywhere" }}>
                {s.email} · WhatsApp {fone(s.whatsapp)} · pediu em {quando(s.criado_em)}
              </div>
              {s.status === "aprovada" && <div style={{ fontSize: 12.5, color: "var(--p-danger)", marginTop: 4 }}>Aprovado, mas o WhatsApp não saiu: {s.whatsapp_erro || "sem resposta"}</div>}
            </div>
            {s.status === "pendente" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button style={ui.botao} disabled={!!ocupado} onClick={() => decidir(s, "aprovar")}>{ocupado === s.id ? "Aguarde..." : "Aprovar"}</button>
                <button style={ui.botaoPerigo} disabled={!!ocupado} onClick={() => decidir(s, "recusar")}>Recusar</button>
              </div>
            ) : (
              <button style={ui.botaoSecundario} disabled={!!ocupado} onClick={() => decidir(s, "reenviar")}>{ocupado === s.id ? "Aguarde..." : "Reenviar WhatsApp"}</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
