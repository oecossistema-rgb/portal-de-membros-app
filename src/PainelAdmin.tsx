// Saúde do sistema (aba da Administração, 25/11/2026): o vigia, os erros e os custos, no mesmo visual 3D da Visão geral.
// "Precisa de você" junta, na hora, o que está parado ou com erro (direto das tabelas) e os alertas do vigia
// (rotinas, WhatsApp, Autentique), sempre com "como resolver". Nada aqui altera dados.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ui } from "./ui";
import { Barra3D, Cartao3D, Indicador, Rosca3D } from "./VisaoGeralAdmin";

type Aba = "membros" | "eventos" | "presencas" | "conteudo" | "contratos" | "sistema";
type Pendencia = { nivel: "erro" | "atencao" | "acao"; aba?: string; titulo: string; quem?: string; desde?: string; detalhe?: string; como?: string };
type Alerta = { chave: string; nivel: "erro" | "atencao"; titulo: string; detalhe: string | null; como_resolver: string | null; aba: string | null; primeira_vez: string };
type Vigia = { verificado_em: string | null; resultado: { whatsapp?: { conectado: boolean }; autentique?: { ok: boolean } } | null };
type Rotina = { nome: string; agenda: string; ativa: boolean; ultima: string | null; execucoes_24h: number; falhas_24h: number; funcoes: number };
type Custo = { chamadas: number; entrada: number; saida: number; custo_usd: number };
type Sistema = { rotinas: Rotina[]; chamadas_6h: { ok: number; erro: number }; ia_mes: { resumos: number; oportunidades: number }; ia_custo?: { mes: Custo; hoje: Custo; desde: string | null }; autentique_mes: number; alertas_resolvidos_30d: number };

const VERDE = "#1f9d55", VERMELHO = "#ec4647", LARANJA = "#f47230";
const COR = { erro: "var(--p-danger)", atencao: "var(--p-warn)", acao: "var(--p-accent-text)" } as const;
const ROTULO = { erro: "Erro", atencao: "Atenção", acao: "Fazer" } as const;
// O que cada rotina faz e em quantos minutos deveria ter rodado de novo (tolerância).
const ROTINAS: Record<string, { nome: string; limite: number }> = {
  "contratos-verificar": { nome: "Contratos e assinaturas", limite: 60 },
  "portal-varredura": { nome: "Resumo, oportunidades e planilha do onboarding", limite: 60 },
  "eventos-avisos": { nome: "Avisos de eventos no WhatsApp", limite: 60 },
  "galeria-miniaturas": { nome: "Miniaturas das fotos", limite: 60 },
  "youtube-sincronizar": { nome: "Vídeos do YouTube", limite: 150 },
  "galeria-renovar": { nome: "Galerias de fotos", limite: 240 },
  vigia: { nome: "Vigia do portal", limite: 150 },
};
const LIMITE_SUPABASE = 500000; // execuções de funções por mês no plano grátis
const dataBR = (s?: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR") : "");
const minutos = (s: string) => Math.round((Date.now() - new Date(s).getTime()) / 60000);
const ha = (s: string) => { const m = minutos(s); return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 48 * 60 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`; };
const mil = (n: number) => n.toLocaleString("pt-BR");

export function PainelAdmin({ onIr }: { onIr: (a: Aba) => void }) {
  const [pend, setPend] = useState<Pendencia[] | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [vigia, setVigia] = useState<Vigia | null>(null);
  const [sis, setSis] = useState<Sistema | null>(null);
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);

  async function carregar() {
    const [r, a, v, s] = await Promise.all([
      supabase.rpc("painel_resumo"),
      supabase.from("portal_alertas").select("chave,nivel,titulo,detalhe,como_resolver,aba,primeira_vez").is("resolvido_em", null).order("nivel"),
      supabase.from("portal_vigia").select("verificado_em,resultado").maybeSingle(),
      supabase.rpc("painel_sistema"),
    ]);
    if (r.error || s.error) { setErro((r.error || s.error)!.message); return; }
    setErro("");
    setPend(((r.data as { pendencias: Pendencia[] })?.pendencias) || []);
    setAlertas((a.data as Alerta[]) || []);
    setVigia((v.data as Vigia) || null);
    setSis(s.data as Sistema);
  }
  useEffect(() => { carregar(); const t = window.setInterval(carregar, 60000); return () => window.clearInterval(t); }, []);

  async function verificarAgora() {
    setVerificando(true);
    await supabase.functions.invoke("vigia", { body: {} });
    await carregar();
    setVerificando(false);
  }

  if (erro) return <div style={ui.erro}>Não foi possível carregar a saúde do sistema: {erro}</div>;
  if (!pend || !sis) return <div style={ui.aviso}>Carregando saúde do sistema...</div>;

  const vigiaMin = vigia?.verificado_em ? minutos(vigia.verificado_em) : Infinity;
  const vigiaParado = vigiaMin > 150;
  const itens: Pendencia[] = [
    ...(vigiaParado ? [{ nivel: "erro" as const, titulo: "O vigia do portal parou de verificar", detalhe: vigia?.verificado_em ? `Última verificação ${ha(vigia.verificado_em)}.` : "Ainda não verificou.", como: "Clique em Verificar agora. Se continuar parado, confira no Supabase se o projeto está ativo e a rotina \"vigia\" ligada." }] : []),
    ...alertas.map((a) => ({ nivel: a.nivel, aba: a.aba || undefined, titulo: a.titulo, detalhe: a.detalhe || undefined, como: a.como_resolver || undefined, desde: a.primeira_vez })),
    ...pend,
  ];
  const problemas = itens.filter((i) => i.nivel !== "acao").length;
  const ok = problemas === 0;
  const zap = vigia?.resultado?.whatsapp?.conectado, aut = vigia?.resultado?.autentique?.ok;
  const execMes = sis.rotinas.reduce((t, r) => t + r.execucoes_24h * r.funcoes, 0) * 30;
  const docs = sis.autentique_mes;

  return (
    <main style={ui.largo}>
      {/* Indicadores */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        <Indicador rotulo="Situação geral" valor={ok ? "Tudo funcionando" : `${problemas} ${problemas === 1 ? "problema" : "problemas"}`} cor={ok ? VERDE : VERMELHO}
          nota={`${sis.alertas_resolvidos_30d} alerta(s) resolvido(s) em 30 dias`} />
        <Indicador rotulo="WhatsApp do portal" valor={zap === false ? "Desconectado" : zap ? "Conectado" : "Sem dados"} cor={zap === false ? VERMELHO : VERDE} nota="mensagens do portal saem por ele" />
        <Indicador rotulo="Autentique (contratos)" valor={aut === false ? "Com erro" : aut ? "Funcionando" : "Sem dados"} cor={aut === false ? VERMELHO : "#257de0"} nota={`${docs} de 10 documentos grátis no mês`} />
        <Indicador rotulo="Vigia do portal" valor={vigia?.verificado_em ? ha(vigia.verificado_em) : "Ainda não verificou"} cor={vigiaParado ? VERMELHO : "#6a4ce2"} nota="verifica tudo de hora em hora" />
      </div>

      {/* Precisa de você */}
      <div style={{ marginBottom: 16 }}>
        <Cartao3D titulo={`Precisa de você${itens.length ? ` (${itens.length})` : ""}`} sub="o que está parado ou com erro, com como resolver" onIr={onIr}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button style={ui.botaoSecundario} disabled={verificando} onClick={(e) => { e.stopPropagation(); verificarAgora(); }}>{verificando ? "Verificando..." : "Verificar agora"}</button>
          </div>
          {!itens.length && <div style={{ fontSize: 14.5, color: VERDE, fontWeight: 600 }}>Nada pendente agora. ✅</div>}
          {itens.map((i, k) => (
            <div key={k} style={{ borderLeft: `4px solid ${COR[i.nivel]}`, background: `color-mix(in srgb, ${COR[i.nivel]} 7%, transparent)`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, boxShadow: "0 3px 0 color-mix(in srgb, var(--p-line) 80%, transparent)" }}>
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
                {i.aba && <button style={ui.botaoSecundario} onClick={(e) => { e.stopPropagation(); onIr(i.aba as Aba); }}>Abrir</button>}
              </div>
            </div>
          ))}
        </Cartao3D>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 16 }}>
        {/* Rotinas */}
        <Cartao3D titulo="Rotinas automáticas" sub="última execução · barra cheia = no limite de atraso" onIr={onIr}>
          <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
            {sis.rotinas.map((r) => {
              const info = ROTINAS[r.nome] || { nome: r.nome, limite: 120 };
              const m = r.ultima ? minutos(r.ultima) : null;
              const atrasada = !r.ativa || (m === null ? r.nome !== "vigia" : m > info.limite) || r.falhas_24h > 0;
              const cor = atrasada ? VERMELHO : m !== null && m > info.limite * 0.7 ? LARANJA : VERDE;
              return (
                <div key={r.nome} title={`${info.nome}: ${r.execucoes_24h} execuções e ${r.falhas_24h} falhas em 24h`}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5 }}>
                    <span style={{ color: "var(--p-text2)" }}>{info.nome}</span>
                    <b style={{ color: atrasada ? VERMELHO : "var(--p-text)", whiteSpace: "nowrap" }}>
                      {!r.ativa ? "desligada" : r.ultima ? ha(r.ultima) : r.nome === "vigia" ? "1ª execução em breve" : "nunca rodou"}{r.falhas_24h ? ` · ${r.falhas_24h} falha(s)` : ""}
                    </b>
                  </div>
                  <Barra3D pct={m === null ? (r.nome === "vigia" ? 0 : 100) : Math.max((m / info.limite) * 100, 3)} cor={cor} />
                </div>
              );
            })}
          </div>
        </Cartao3D>

        {/* Chamadas internas */}
        <Cartao3D titulo="Chamadas internas" sub="funções chamadas pelo banco nas últimas 6 horas" onIr={onIr}>
          <Rosca3D fatias={[{ rotulo: "Funcionaram", valor: sis.chamadas_6h.ok, cor: VERDE }, { rotulo: "Com erro", valor: sis.chamadas_6h.erro, cor: VERMELHO }]} />
          <div style={{ fontSize: 12.5, color: "var(--p-muted)", marginTop: 6 }}>O banco só guarda as últimas 6 horas dessas chamadas; o vigia confere de hora em hora.</div>
        </Cartao3D>

        {/* Custos */}
        <Cartao3D titulo="Custos e limites" sub="neste mês" onIr={onIr}>
          <div style={{ display: "grid", gap: 14, paddingTop: 4 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span style={{ color: "var(--p-text2)" }}>Autentique: documentos (10 grátis)</span><b>{docs} de 10</b></div>
              <Barra3D pct={(docs / 10) * 100} cor={docs >= 8 ? LARANJA : "#257de0"} />
              <div style={{ fontSize: 12, color: "var(--p-muted)", marginTop: 4 }}>Depois dos 10, cerca de R$ 0,10 por documento.</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span style={{ color: "var(--p-text2)" }}>Supabase: execuções de funções (estimativa)</span><b style={{ whiteSpace: "nowrap" }}>{mil(execMes)} de {mil(LIMITE_SUPABASE)}</b></div>
              <Barra3D pct={(execMes / LIMITE_SUPABASE) * 100} cor={execMes > LIMITE_SUPABASE * 0.8 ? LARANJA : VERDE} />
              <div style={{ fontSize: 12, color: "var(--p-muted)", marginTop: 4 }}>{Math.round((execMes / LIMITE_SUPABASE) * 100)}% do limite grátis, calculado pelas rotinas das últimas 24 horas.</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span style={{ color: "var(--p-text2)" }}>IA (API do Claude): gasto no mês</span><b>US$ {(sis.ia_custo?.mes.custo_usd ?? 0).toFixed(2)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginTop: 6 }}><span style={{ color: "var(--p-text2)" }}>IA: gasto hoje</span><b>US$ {(sis.ia_custo?.hoje.custo_usd ?? 0).toFixed(2)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginTop: 6 }}><span style={{ color: "var(--p-text2)" }}>IA: usos no mês (tokens)</span><b>{sis.ia_custo?.mes.chamadas ?? 0} ({mil((sis.ia_custo?.mes.entrada ?? 0) + (sis.ia_custo?.mes.saida ?? 0))})</b></div>
              <div style={{ fontSize: 12, color: "var(--p-muted)", marginTop: 4 }}>Resumo do perfil e oportunidades são as únicas partes que usam IA. Gasto calculado na hora, a cada uso, com o preço de tabela{sis.ia_custo?.desde ? `; contando desde ${dataBR(sis.ia_custo.desde)}` : "; começa a contar no próximo uso"}. Saldo de créditos: pendente (precisa de chave de administrador da Anthropic).</div>
            </div>
          </div>
        </Cartao3D>
      </div>
    </main>
  );
}
