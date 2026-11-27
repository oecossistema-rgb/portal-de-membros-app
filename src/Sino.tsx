// Sino de notificações (27/11/2026), para todos os perfis. Uma consulta leve a cada 2 minutos (só com a aba do
// navegador à vista) e ao voltar para o portal. Abrir o sino marca tudo como visto.
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

type Notificacao = { id: string; tipo: string; etiqueta: string | null; titulo: string; quem: string | null; texto: string | null; link: string | null; criado_em: string; nova: boolean };

// Pedido para abrir um item numa seção (ex.: uma oferta), mesmo que a seção ainda não tenha carregado.
let pendente: string | null = null;
export function pedirAbrir(link: string) {
  pendente = link;
  window.dispatchEvent(new CustomEvent("portal:abrir", { detail: link }));
}
export function pegarPedido(prefixo: string): string | null {
  const daUrl = window.location.hash.replace("#", "");
  const link = pendente || (daUrl.includes("/") ? daUrl : null);
  if (!link || !link.startsWith(`${prefixo}/`)) return null;
  pendente = null;
  return link.slice(prefixo.length + 1);
}

const quando = (d: string) => {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export function Sino({ onIr, cor }: { onIr: (secao: string) => void; cor: string }) {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [novas, setNovas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  async function carregar() {
    const { data, error } = await supabase.rpc("minhas_notificacoes");
    if (error || !data) return;
    const d = data as { itens: Notificacao[]; novas: number };
    setItens(d.itens || []); setNovas(d.novas || 0);
  }
  useEffect(() => {
    carregar();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") carregar(); }, 120000);
    const volta = () => { if (document.visibilityState === "visible") carregar(); };
    document.addEventListener("visibilitychange", volta);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  function abrir() {
    const vai = !aberto;
    setAberto(vai);
    if (vai && novas > 0) { setNovas(0); supabase.rpc("notificacoes_vistas").then(() => {}, () => {}); }
  }
  function ir(n: Notificacao) {
    setAberto(false);
    if (!n.link) return;
    onIr(n.link.split("/")[0]);
    pedirAbrir(n.link);
  }

  return (
    <div ref={caixa} style={{ position: "relative" }}>
      <button title="Notificações" aria-label={novas ? `Notificações: ${novas} nova(s)` : "Notificações"} aria-expanded={aberto} onClick={abrir}
        style={{ background: "none", border: 0, color: cor, cursor: "pointer", position: "relative", padding: 6, display: "flex" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {novas > 0 && <span style={{ position: "absolute", top: 1, right: 0, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 100,
          background: "var(--p-danger)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid var(--p-card)" }}>{novas > 9 ? "9+" : novas}</span>}
      </button>
      {aberto && (
        <div role="dialog" aria-label="Notificações" className="pv-card" style={{ position: "fixed", right: 14, top: 64, width: "min(360px, calc(100vw - 28px))",
          maxHeight: "70vh", overflowY: "auto", zIndex: 40, padding: 6 }}>
          <div style={{ padding: "8px 10px 6px", fontWeight: 700, fontSize: 14.5, color: "var(--p-text)" }}>Notificações</div>
          {!itens.length && <div style={{ padding: "14px 10px 16px", fontSize: 13.5, color: "var(--p-muted)" }}>Nada novo por aqui ainda.</div>}
          {itens.map((n) => (
            <button key={n.id} onClick={() => ir(n)} style={{ display: "block", width: "100%", textAlign: "left", background: n.nova ? "var(--p-accent-bg)" : "none",
              border: 0, borderRadius: 12, padding: "11px 12px", cursor: n.link ? "pointer" : "default", fontFamily: "inherit", color: "var(--p-text)", marginBottom: 2 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ flex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--p-accent-text)" }}>{n.etiqueta || "Aviso"}</span>
                <span style={{ fontSize: 11, color: "var(--p-muted)", whiteSpace: "nowrap" }}>{quando(n.criado_em)}</span>
              </div>
              <div style={{ fontWeight: 650, fontSize: 14.5, lineHeight: 1.3, marginTop: 3 }}>{n.titulo}</div>
              {n.quem && <div style={{ fontSize: 12.5, color: "var(--p-text2)", marginTop: 2 }}>{n.quem}</div>}
              {n.texto && <div style={{ fontSize: 13, color: "var(--p-muted)", marginTop: 5, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.texto}</div>}
              {n.link && <div style={{ fontSize: 12.5, color: "var(--p-accent-text)", fontWeight: 650, marginTop: 7 }}>{n.tipo === "oferta" ? "Ver oportunidade →" : "Abrir →"}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
