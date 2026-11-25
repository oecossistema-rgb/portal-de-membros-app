// Painel: primeira tela da Administração (25/11/2026). Só visualização: cada quadro leva para a aba que já existe.
// "Precisa de você" junta, na hora, o que está parado ou com erro (direto das tabelas) e os alertas do vigia
// (rotinas, WhatsApp, Autentique), sempre com "como resolver". Nada aqui altera dados.
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";

type Aba = "membros" | "eventos" | "presencas" | "conteudo" | "contratos";
type Pendencia = { nivel: "erro" | "atencao" | "acao"; aba?: string; titulo: string; quem?: string; desde?: string; detalhe?: string; como?: string };
type Alerta = { chave: string; nivel: "erro" | "atencao"; titulo: string; detalhe: string | null; como_resolver: string | null; aba: string | null; primeira_vez: string };
type Resumo = {
  membros: Record<string, number>;
  contratos: Record<string, number>;
  eventos: { proximo: { titulo: string; data: string; vagas: number | null; confirmados: number; fila: number } | null; ultimo: { titulo: string; data: string; presentes: number } | null };
  pendencias: Pendencia[];
};
type Vigia = { verificado_em: string | null; resultado: { whatsapp?: { conectado: boolean }; autentique?: { ok: boolean }; autentique_documentos_mes?: number; rotinas?: { nome: string }[] } | null };

const COR = { erro: "var(--p-danger)", atencao: "var(--p-warn)", acao: "var(--p-accent-text)" } as const;
const ROTULO = { erro: "Erro", atencao: "Atenção", acao: "Fazer" } as const;
const VERDE = "#1f9d55";
const dataBR = (s?: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR") : "");
const ha = (s: string) => {
  const min = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  return min < 1 ? "agora" : min < 60 ? `há ${min} min` : min < 48 * 60 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`;
};

function Quadro({ titulo, aba, onIr, children }: { titulo: string; aba?: Aba; onIr: (a: Aba) => void; children: ReactNode }) {
  return (
    <div style={{ ...ui.cartao, marginBottom: 0, padding: "16px 18px", cursor: aba ? "pointer" : "default" }} onClick={() => aba && onIr(aba)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{titulo}</div>
        {aba && <span style={{ fontSize: 12.5, color: "var(--p-accent-text)", fontWeight: 600 }}>Abrir →</span>}
      </div>
      {children}
    </div>
  );
}
function Linha({ rotulo, valor, cor }: { rotulo: string; valor: ReactNode; cor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", fontSize: 14, borderBottom: "1px solid var(--p-line)" }}>
      <span style={{ color: "var(--p-muted)" }}>{rotulo}</span><b style={{ color: cor || "var(--p-text)" }}>{valor}</b>
    </div>
  );
}

export function PainelAdmin({ onIr }: { onIr: (a: Aba) => void }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [vigia, setVigia] = useState<Vigia | null>(null);
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);

  async function carregar() {
    const [r, a, v] = await Promise.all([
      supabase.rpc("painel_resumo"),
      supabase.from("portal_alertas").select("chave,nivel,titulo,detalhe,como_resolver,aba,primeira_vez").is("resolvido_em", null).order("nivel"),
      supabase.from("portal_vigia").select("verificado_em,resultado").maybeSingle(),
    ]);
    if (r.error) setErro(r.error.message); else { setErro(""); setResumo(r.data as Resumo); }
    setAlertas((a.data as Alerta[]) || []);
    setVigia((v.data as Vigia) || null);
  }
  useEffect(() => { carregar(); const t = window.setInterval(carregar, 60000); return () => window.clearInterval(t); }, []);

  async function verificarAgora() {
    setVerificando(true);
    await supabase.functions.invoke("vigia", { body: {} });
    await carregar();
    setVerificando(false);
  }

  if (erro) return <div style={ui.erro}>Não foi possível carregar o painel: {erro}</div>;
  if (!resumo) return <div style={ui.aviso}>Carregando painel...</div>;

  const m = resumo.membros, c = resumo.contratos, ev = resumo.eventos;
  const vigiaMin = vigia?.verificado_em ? (Date.now() - new Date(vigia.verificado_em).getTime()) / 60000 : Infinity;
  const vigiaParado = vigiaMin > 150;
  const itens: Pendencia[] = [
    ...(vigiaParado ? [{ nivel: "erro" as const, titulo: "O vigia do portal parou de verificar", detalhe: vigia?.verificado_em ? `Última verificação ${ha(vigia.verificado_em)}.` : "Ainda não verificou.", como: "Clique em Verificar agora. Se continuar parado, confira no Supabase se o projeto está ativo e a rotina \"vigia\" ligada." }] : []),
    ...alertas.map((a) => ({ nivel: a.nivel, aba: a.aba || undefined, titulo: a.titulo, detalhe: a.detalhe || undefined, como: a.como_resolver || undefined, desde: a.primeira_vez })),
    ...resumo.pendencias,
  ];
  const problemas = itens.filter((i) => i.nivel !== "acao").length;
  const ok = problemas === 0;
  const docs = vigia?.resultado?.autentique_documentos_mes ?? c.autentique_mes ?? 0;

  return (
    <main style={ui.largo}>
      {/* Saúde do sistema */}
      <div style={{ ...ui.cartao, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 18px", border: `1.5px solid ${ok ? VERDE : "var(--p-danger)"}` }}>
        <div style={{ width: 12, height: 12, borderRadius: 99, background: ok ? VERDE : "var(--p-danger)", flex: "none" }} />
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ fontWeight: 700, color: ok ? VERDE : "var(--p-danger)" }}>{ok ? "Tudo funcionando" : `${problemas} ${problemas === 1 ? "problema precisa" : "problemas precisam"} de atenção`}</div>
          <div style={{ fontSize: 12.5, color: vigiaParado ? "var(--p-danger)" : "var(--p-muted)" }}>
            Vigia: {vigia?.verificado_em ? `última verificação ${ha(vigia.verificado_em)}` : "ainda não verificou"} · confere rotinas, WhatsApp e Autentique de hora em hora
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12.5 }}>
          <span style={{ color: vigia?.resultado?.whatsapp?.conectado === false ? "var(--p-danger)" : VERDE, fontWeight: 600 }}>● WhatsApp {vigia?.resultado?.whatsapp?.conectado === false ? "desconectado" : "conectado"}</span>
          <span style={{ color: vigia?.resultado?.autentique?.ok === false ? "var(--p-danger)" : VERDE, fontWeight: 600 }}>● Autentique {vigia?.resultado?.autentique?.ok === false ? "com erro" : "ok"}</span>
        </div>
        <button style={ui.botaoSecundario} disabled={verificando} onClick={verificarAgora}>{verificando ? "Verificando..." : "Verificar agora"}</button>
      </div>

      {/* Precisa de você */}
      <div style={{ ...ui.cartao, padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: itens.length ? 10 : 4 }}>Precisa de você {itens.length > 0 && <span style={{ color: "var(--p-muted)", fontWeight: 500 }}>({itens.length})</span>}</div>
        {!itens.length && <div style={{ fontSize: 14, color: "var(--p-muted)" }}>Nada pendente agora. ✅</div>}
        {itens.map((i, k) => (
          <div key={k} style={{ borderLeft: `4px solid ${COR[i.nivel]}`, background: `color-mix(in srgb, ${COR[i.nivel]} 7%, transparent)`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14 }}>
                  <span style={{ color: COR[i.nivel], fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", marginRight: 6 }}>{ROTULO[i.nivel]}</span>
                  {i.titulo}{i.quem ? ` · ${i.quem}` : ""}
                </div>
                {i.detalhe && <div style={{ fontSize: 12.5, color: "var(--p-muted)", marginTop: 2, wordBreak: "break-word" }}>{i.detalhe}</div>}
                {i.como && <div style={{ fontSize: 13, marginTop: 4 }}><b>Como resolver:</b> {i.como}</div>}
                {i.desde && <div style={{ fontSize: 11.5, color: "var(--p-muted)", marginTop: 3 }}>desde {dataBR(i.desde)}</div>}
              </div>
              {i.aba && <button style={ui.botaoSecundario} onClick={() => onIr(i.aba as Aba)}>Abrir</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Números */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        <Quadro titulo="Membros" aba="membros" onIr={onIr}>
          <Linha rotulo="Membros ativos" valor={m.ativos} />
          <Linha rotulo="Novos neste mês" valor={m.novos_mes} />
          <Linha rotulo="Contrato em andamento" valor={m.contrato_andamento} />
          <Linha rotulo="Onboarding pendente" valor={m.onboarding_pendente} cor={m.onboarding_pendente ? "var(--p-warn)" : undefined} />
          <Linha rotulo="Ainda não criaram senha" valor={m.sem_senha} cor={m.sem_senha ? "var(--p-warn)" : undefined} />
        </Quadro>
        <Quadro titulo="Contratos" aba="contratos" onIr={onIr}>
          <Linha rotulo="Aguardando formulário" valor={c.aguardando_formulario} />
          <Linha rotulo="Em revisão" valor={c.revisao} cor={c.revisao ? "var(--p-warn)" : undefined} />
          <Linha rotulo="Aguardando assinaturas" valor={c.enviado} />
          <Linha rotulo="Assinados neste mês" valor={c.assinados_mes} cor={c.assinados_mes ? VERDE : undefined} />
          <Linha rotulo="Vencem em até 60 dias" valor={c.vencendo_60d} cor={c.vencendo_60d ? "var(--p-warn)" : undefined} />
          <Linha rotulo="Vencidos" valor={c.vencidos} cor={c.vencidos ? "var(--p-danger)" : undefined} />
        </Quadro>
        <Quadro titulo="Eventos" aba="eventos" onIr={onIr}>
          {ev.proximo ? <>
            <div style={{ fontSize: 13, color: "var(--p-muted)" }}>Próximo</div>
            <div style={{ fontWeight: 650, marginBottom: 4 }}>{ev.proximo.titulo} · {dataBR(ev.proximo.data)}</div>
            <Linha rotulo="Confirmados" valor={ev.proximo.vagas ? `${ev.proximo.confirmados} de ${ev.proximo.vagas} vagas` : ev.proximo.confirmados} />
            <Linha rotulo="Lista de espera" valor={ev.proximo.fila} />
          </> : <div style={{ fontSize: 14, color: "var(--p-muted)" }}>Nenhum evento futuro cadastrado.</div>}
          {ev.ultimo && <div style={{ fontSize: 12.5, color: "var(--p-muted)", marginTop: 8 }}>Último: {ev.ultimo.titulo} ({dataBR(ev.ultimo.data)}) · {ev.ultimo.presentes} presença(s) registrada(s)</div>}
        </Quadro>
        <Quadro titulo="Engajamento no portal" aba="membros" onIr={onIr}>
          <Linha rotulo="Entraram nos últimos 30 dias" valor={`${m.acessaram_30d} de ${m.ativos}`} />
          <Linha rotulo="Com senha, sem entrar há 30 dias" valor={m.sumidos_30d} cor={m.sumidos_30d ? "var(--p-warn)" : undefined} />
          <Linha rotulo="Pedidos de acesso aguardando" valor={m.solicitacoes} cor={m.solicitacoes ? "var(--p-warn)" : undefined} />
        </Quadro>
        <Quadro titulo="Custos e limites" onIr={onIr}>
          <Linha rotulo="Autentique: documentos no mês" valor={`${docs} de 10 grátis`} cor={docs >= 8 ? "var(--p-warn)" : VERDE} />
          <Linha rotulo="Rotinas automáticas" valor={`${vigia?.resultado?.rotinas?.length ?? "-"} (sem IA, exceto resumo e oportunidades)`} />
          <div style={{ fontSize: 12, color: "var(--p-muted)", marginTop: 6 }}>Depois dos 10 grátis, cada documento da Autentique custa cerca de R$ 0,10.</div>
        </Quadro>
      </div>
    </main>
  );
}
