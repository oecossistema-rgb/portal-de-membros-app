import type { CSSProperties } from "react";

// Estilos compartilhados das telas novas (mesma paleta do portal).
export const ui: Record<string, CSSProperties> = {
  hero: { background: "#1A1F2B", padding: "12px 0 56px" },
  heroInner: { maxWidth: 880, margin: "0 auto", padding: "0 24px" },
  heroEyebrow: { fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#8BAD3F", fontWeight: 600, marginBottom: 16 },
  heroTitle: { fontSize: 36, lineHeight: 1.1, fontWeight: 800, color: "#fff", margin: "0 0 16px", letterSpacing: -0.5 },
  heroSub: { fontSize: 16, lineHeight: 1.6, color: "#B8C0CC", maxWidth: 560, margin: 0 },
  lista: { maxWidth: 880, margin: "24px auto 0", padding: "0 24px 48px" },
  largo: { maxWidth: 1100, margin: "24px auto 0", padding: "0 24px 48px" },
  cartao: { background: "#fff", border: "1px solid #EAECE6", borderRadius: 14, padding: "24px 22px", marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 6 },
  input: { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #D8DCD2", fontSize: 15, boxSizing: "border-box", outline: "none", fontFamily: "inherit", background: "#fff", color: "#1A1F2B" },
  botao: { background: "#8BAD3F", color: "#1A2410", border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  botaoSecundario: { background: "#fff", color: "#1A1F2B", border: "1.5px solid #D8DCD2", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  botaoPerigo: { background: "#fff", color: "#9A3B3B", border: "1.5px solid #E5C2C2", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  ok: { background: "#E8F0D8", color: "#4A6118", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, marginBottom: 10 },
  erro: { background: "#F7E4E4", color: "#9A3B3B", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 600, marginBottom: 10 },
  aviso: { background: "#fff", border: "1px solid #EAECE6", borderRadius: 14, padding: 24, fontSize: 15, color: "#4A5568", textAlign: "center" },
};
