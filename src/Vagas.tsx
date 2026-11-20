// Vagas dos eventos: em que momento o evento está (vagas abrem em breve, aberto, lotado, fila, confirmado)
// e os botões/informações de cada momento. Usado na Agenda (versão compacta) e no destaque da tela inicial.
import type { ReactNode } from "react";
import { supabase } from "./supabase";

export type FotoConfirmado = { nome: string; foto: string | null };
export type VagaInfo = {
  vagas: number | null; abre_em: string | null; confirmados: number; fila: number;
  minha: "confirmado" | "fila" | "aviso" | null; posicao: number; fotos: FotoConfirmado[];
};
export type EventoComVaga = {
  id: string; trilha: string; titulo: string; quando: string; diaSemana?: string; dataOrdenacao: string;
  inscrivel?: boolean; local?: string | null; vaga?: VagaInfo;
};
export type Estado = "passado" | "confirmado" | "fechado" | "em_breve" | "aberto" | "lotado" | "livre";
export type AcoesVaga = {
  onConfirmar?: (e: EventoComVaga) => void;
  onCancelar?: (e: EventoComVaga) => void;
  onLista?: (e: EventoComVaga, tipo: "fila" | "aviso", entrar: boolean) => void;
};

export async function carregarVagas(membroId?: string): Promise<Record<string, VagaInfo>> {
  const { data } = await supabase.rpc("eventos_vagas", membroId ? { p_membro: membroId } : {});
  const m: Record<string, VagaInfo> = {};
  (data || []).forEach((v: VagaInfo & { evento_id: string }) => { m[v.evento_id] = { ...v, fotos: v.fotos || [] }; });
  return m;
}

const dataEv = (e: EventoComVaga) => { const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(e.dataOrdenacao || ""); return x ? new Date(+x[1], +x[2] - 1, +x[3]) : null; };

export function estadoEvento(e: EventoComVaga, confirmado: boolean): Estado {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = dataEv(e);
  if (d && d < hoje) return "passado";
  const v = e.vaga;
  if (confirmado || v?.minha === "confirmado") return "confirmado";
  if (e.inscrivel === false) return "fechado";
  if (v?.abre_em && new Date(v.abre_em).getTime() > Date.now()) return "em_breve";
  if (v?.vagas) return v.confirmados >= v.vagas ? "lotado" : "aberto";
  return "livre";
}

export function quandoAbre(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const h = d.getHours(), min = d.getMinutes();
  return `${dia} às ${h}h${min ? String(min).padStart(2, "0") : ""}`;
}

// Link para colocar o encontro na agenda: iPhone/Mac baixa o arquivo do calendário; os demais abrem o Google Agenda.
export function adicionarAgenda(e: EventoComVaga) {
  const d = dataEv(e); if (!d) return;
  const f = (x: Date) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
  const fim = new Date(d); fim.setDate(fim.getDate() + 1);
  const titulo = `${e.titulo} · Ecossistema Master Business`;
  const detalhes = `Presença confirmada no portal: https://portal.oecossistemabusiness.com`;
  if (/iPhone|iPad|Macintosh/.test(navigator.userAgent) && !/Chrome|Android/.test(navigator.userAgent)) {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ecossistema//Portal//PT", "BEGIN:VEVENT", `UID:${e.id}@portal.oecossistemabusiness.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${f(d)}`, `DTEND;VALUE=DATE:${f(fim)}`,
      `SUMMARY:${titulo}`, `DESCRIPTION:${detalhes}`, ...(e.local ? [`LOCATION:${e.local}`] : []), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = `${e.id}.ics`; a.click();
    return;
  }
  const q = new URLSearchParams({ action: "TEMPLATE", text: titulo, dates: `${f(d)}/${f(fim)}`, details: detalhes, ...(e.local ? { location: e.local } : {}) });
  window.open(`https://calendar.google.com/calendar/render?${q}`, "_blank", "noopener");
}

export const CSS_VAGAS = `
.vg-barra{ height:6px; border-radius:6px; background:var(--p-hover); overflow:hidden; margin-top:6px }
.vg-barra > i{ display:block; height:100%; border-radius:6px; background:var(--p-accent); transition:width .4s ease }
.vg-barra.cheia > i{ background:var(--p-warn) }
.vg-info{ font-size:13px; color:var(--p-text2) }
.vg-info strong{ color:var(--p-text) }
.vg-link{ border:0; background:none; padding:0; font:inherit; font-size:12.5px; color:var(--p-muted); text-decoration:underline; cursor:pointer }
.vg-link:hover{ color:var(--p-text) }
.vg-selo{ display:inline-flex; align-items:center; gap:8px; border-radius:12px; padding:9px 13px; font-size:13.5px; font-weight:600; line-height:1.25 }
.vg-selo.ok{ background:var(--p-accent-bg); color:var(--p-accent-text) }
.vg-selo.alerta{ background:color-mix(in srgb, var(--p-warn) 12%, transparent); color:var(--p-warn) }
.vg-selo.neutro{ background:var(--p-hover); color:var(--p-text2) }
.vg-fotos{ display:flex; align-items:center; gap:10px; font-size:12.5px; color:var(--p-muted) }
.vg-fotos-pilha{ display:flex }
.vg-fotos-pilha > *{ width:28px; height:28px; border-radius:50%; border:2px solid var(--p-card); margin-left:-8px; object-fit:cover; background:var(--p-accent-bg); color:var(--p-accent-text);
  display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:700 }
.vg-fotos-pilha > *:first-child{ margin-left:0 }
.vg-acao{ display:flex; flex-direction:column; gap:8px; align-items:flex-end; min-width:200px }
.vg-acao.grande{ align-items:flex-start; min-width:0 }
.vg-linha{ display:flex; gap:12px; align-items:center; flex-wrap:wrap }
@media (max-width:640px){ .vg-acao{ align-items:stretch; min-width:0 } }
`;

export function BarraVagas({ v }: { v: VagaInfo }) {
  if (!v.vagas) return null;
  const restam = Math.max(0, v.vagas - v.confirmados);
  const pct = Math.min(100, Math.round((v.confirmados / v.vagas) * 100));
  return (
    <div style={{ width: "100%", maxWidth: 260 }}>
      <div className="vg-info">{restam > 0 ? <>Restam <strong>{restam}</strong> de {v.vagas} vagas</> : <><strong>{v.vagas} de {v.vagas}</strong> vagas preenchidas</>}</div>
      <div className={`vg-barra${restam === 0 ? " cheia" : ""}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function FotosConfirmados({ v, max = 5 }: { v?: VagaInfo; max?: number }) {
  if (!v || !v.confirmados || !v.fotos.length) return null;
  const mostra = v.fotos.slice(0, max);
  const nomes = v.fotos.slice(0, 2).map((f) => f.nome).filter(Boolean);
  const resto = v.confirmados - nomes.length;
  const texto = `${nomes.join(nomes.length === 2 && resto <= 0 ? " e " : ", ")}${resto > 0 ? ` e +${resto}` : ""} ${v.confirmados === 1 ? "vai" : "vão"}`;
  return (
    <div className="vg-fotos">
      <span className="vg-fotos-pilha">
        {mostra.map((f, i) => f.foto ? <img key={i} src={f.foto} alt="" loading="lazy" /> : <span key={i}>{(f.nome || "?")[0]}</span>)}
      </span>
      <span>{texto}</span>
    </div>
  );
}

// Botões e informações do momento do evento. "grande" = destaque da tela inicial.
export function AcaoVaga({ e, estado, acoes, grande, botao, botao2 }: {
  e: EventoComVaga; estado: Estado; acoes: AcoesVaga; grande?: boolean; botao: string; botao2?: string;
}): ReactNode {
  const v = e.vaga;
  const cls = `vg-acao${grande ? " grande" : ""}`;
  const confirmar = (rotulo: string) => <button className={botao} onClick={() => acoes.onConfirmar?.(e)} disabled={!acoes.onConfirmar}>{rotulo}</button>;
  switch (estado) {
    case "confirmado": {
      const vespera = (() => { const d = dataEv(e); const h = new Date(); h.setHours(0, 0, 0, 0); return !!(v?.vagas && d && d.getTime() <= h.getTime()); })();
      return (
        <div className={cls}>
          <span className="vg-selo ok">✓ {v?.vagas ? "Sua vaga está garantida" : "Presença confirmada"}</span>
          <div className="vg-linha">
            <button className={botao2 || "vg-link"} onClick={() => adicionarAgenda(e)}>Adicionar à minha agenda</button>
            {acoes.onCancelar && !vespera && <button className="vg-link" onClick={() => acoes.onCancelar?.(e)}>Cancelar presença</button>}
          </div>
        </div>
      );
    }
    case "fechado":
      return <div className={cls}><span className="vg-selo neutro">Inscrições encerradas</span></div>;
    case "em_breve":
      return (
        <div className={cls}>
          <span className="vg-selo neutro">Vagas abrem {quandoAbre(v!.abre_em!)}{v?.vagas ? ` · apenas ${v.vagas} vagas` : ""}</span>
          {v?.minha === "aviso"
            ? <div className="vg-linha"><span className="vg-selo ok">✓ Vamos te avisar no WhatsApp</span><button className="vg-link" onClick={() => acoes.onLista?.(e, "aviso", false)}>Desfazer</button></div>
            : <button className={botao} onClick={() => acoes.onLista?.(e, "aviso", true)} disabled={!acoes.onLista}>Me avise quando abrir</button>}
        </div>
      );
    case "aberto":
      return <div className={cls}>{v && <BarraVagas v={v} />}{confirmar("Garantir minha vaga")}</div>;
    case "lotado":
      return (
        <div className={cls}>
          <span className="vg-selo alerta">Vagas 100% preenchidas</span>
          {v?.minha === "fila"
            ? <div className="vg-linha"><span className="vg-selo ok">Você é o {v.posicao}º da fila. Se abrir vaga, avisamos você.</span><button className="vg-link" onClick={() => acoes.onLista?.(e, "fila", false)}>Sair da fila</button></div>
            : <button className={botao} onClick={() => acoes.onLista?.(e, "fila", true)} disabled={!acoes.onLista}>Entrar na fila de espera</button>}
        </div>
      );
    case "livre":
      return <div className={cls}>{confirmar("Confirmar presença")}</div>;
    default:
      return null;
  }
}
