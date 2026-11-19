import type { CSSProperties } from "react";

// Estilos compartilhados das telas (visual estilo Apple, claro/escuro conforme o tema).
const CARD = "var(--p-card)";
export const ui: Record<string, CSSProperties> = {
  hero: { background: "transparent", padding: "0 0 6px" },
  heroInner: { maxWidth: "none", margin: 0, padding: 0 },
  heroEyebrow: { fontSize: 13, letterSpacing: 0, textTransform: "none", color: "var(--p-accent-text)", fontWeight: 600, marginBottom: 6 },
  heroTitle: { fontSize: 34, lineHeight: 1.1, fontWeight: 700, color: "var(--p-text)", margin: "0 0 10px", letterSpacing: "-0.025em" },
  heroSub: { fontSize: 17, lineHeight: 1.5, color: "var(--p-muted)", maxWidth: 760, margin: 0 },
  lista: { maxWidth: 980, margin: "12px 0 0", padding: "0 0 24px" },
  largo: { maxWidth: "none", margin: 0, padding: "0 0 24px" },
  cartao: { background: CARD, border: "1px solid var(--p-line)", borderRadius: 20, boxShadow: "var(--p-shadow)", padding: "22px 20px", marginBottom: 12, color: "var(--p-text)" },
  label: { fontSize: 13, fontWeight: 600, color: "var(--p-text2)", display: "block", marginBottom: 6 },
  input: { width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--p-line2)", fontSize: 15, boxSizing: "border-box", outline: "none", fontFamily: "inherit", background: "var(--p-field)", color: "var(--p-text)" },
  botao: { background: "var(--p-accent)", color: "var(--p-on-accent)", border: "none", borderRadius: 980, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  botaoSecundario: { background: "var(--p-card)", color: "var(--p-text)", border: "1px solid var(--p-line2)", borderRadius: 980, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  botaoPerigo: { background: "var(--p-card)", color: "var(--p-danger)", border: "1px solid var(--p-danger-line)", borderRadius: 980, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  ok: { background: "color-mix(in srgb, var(--p-accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--p-accent) 30%, transparent)", color: "var(--p-accent-text)", borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 600, marginBottom: 10 },
  erro: { background: "color-mix(in srgb, var(--p-danger) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--p-danger) 30%, transparent)", color: "var(--p-danger)", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, marginBottom: 10 },
  aviso: { background: CARD, border: "1px solid var(--p-line)", borderRadius: 20, padding: 24, fontSize: 15, color: "var(--p-muted)", textAlign: "center" },
};
