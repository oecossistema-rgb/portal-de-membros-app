// Aviso fixo no rodapé da tela: aparece sempre à vista, mesmo com a página rolada.
// Erro fica até a pessoa fechar; sucesso some sozinho em 5 segundos.
import { useEffect } from "react";

export function Aviso({ msg, onFechar }: { msg: { tipo: "ok" | "erro"; texto: string } | null; onFechar: () => void }) {
  useEffect(() => {
    if (msg?.tipo !== "ok") return;
    const t = setTimeout(onFechar, 5000);
    return () => clearTimeout(t);
  }, [msg, onFechar]);
  if (!msg) return null;
  const erro = msg.tipo === "erro";
  return (
    <div role={erro ? "alert" : "status"} style={{
      position: "fixed", left: 16, right: 16, bottom: 20, zIndex: 80, margin: "0 auto", maxWidth: 640,
      display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: 12,
      background: "var(--p-card)", boxShadow: "0 10px 30px rgba(0,0,0,.25)",
      border: `1.5px solid ${erro ? "var(--p-danger)" : "var(--p-accent)"}`,
      color: erro ? "var(--p-danger)" : "var(--p-accent-text)", fontSize: 14.5, fontWeight: 600, lineHeight: 1.4,
    }}>
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>{erro ? "⚠️" : "✅"}</span>
      <span style={{ flex: 1 }}>{msg.texto}</span>
      <button onClick={onFechar} aria-label="Fechar aviso" style={{
        background: "none", border: 0, cursor: "pointer", fontSize: 20, lineHeight: 1, color: "var(--p-muted, #888)", padding: 0,
      }}>×</button>
    </div>
  );
}
