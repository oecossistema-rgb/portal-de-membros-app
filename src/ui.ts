import type { CSSProperties } from "react";

// Estilos compartilhados das telas (tema escuro do portal, verde neon).
const CARD = "linear-gradient(180deg,#0E1714 0%,#0B1210 100%)";
export const ui: Record<string, CSSProperties> = {
  hero: { background: "transparent", padding: "0 0 6px" },
  heroInner: { maxWidth: "none", margin: 0, padding: 0 },
  heroEyebrow: { fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#2BE36B", fontWeight: 700, marginBottom: 10 },
  heroTitle: { fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: "#fff", margin: "0 0 10px", letterSpacing: -0.5 },
  heroSub: { fontSize: 15, lineHeight: 1.6, color: "#97A69E", maxWidth: 760, margin: 0 },
  lista: { maxWidth: 980, margin: "12px 0 0", padding: "0 0 24px" },
  largo: { maxWidth: "none", margin: 0, padding: "0 0 24px" },
  cartao: { background: CARD, border: "1px solid #1B2A23", borderRadius: 14, padding: "22px 20px", marginBottom: 12, color: "#E9F0EC" },
  label: { fontSize: 13, fontWeight: 600, color: "#C9D3CD", display: "block", marginBottom: 6 },
  input: { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #24392F", fontSize: 15, boxSizing: "border-box", outline: "none", fontFamily: "inherit", background: "#0A100E", color: "#E9F0EC" },
  botao: { background: "linear-gradient(180deg,#43F07F 0%,#22D262 100%)", color: "#03140A", border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 6px 18px -8px #2BE36B" },
  botaoSecundario: { background: "#0B1210", color: "#E9F0EC", border: "1px solid #24392F", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  botaoPerigo: { background: "#0B1210", color: "#FF8A8A", border: "1px solid #5A2A2A", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  ok: { background: "rgba(43,227,107,.1)", border: "1px solid rgba(43,227,107,.3)", color: "#2BE36B", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, marginBottom: 10 },
  erro: { background: "rgba(255,90,90,.08)", border: "1px solid rgba(255,90,90,.3)", color: "#FF9A9A", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, marginBottom: 10 },
  aviso: { background: CARD, border: "1px solid #1B2A23", borderRadius: 14, padding: 24, fontSize: 15, color: "#97A69E", textAlign: "center" },
};
