// Tema claro/escuro do portal. Sem escolha salva, segue o aparelho (configuração do sistema).
export type Tema = "claro" | "escuro";

export function temaSalvo(): Tema | null {
  try { const t = localStorage.getItem("portal-tema"); return t === "claro" || t === "escuro" ? t : null; } catch { return null; }
}
export function temaAtual(): Tema {
  const t = document.documentElement.dataset.tema as Tema | undefined;
  if (t === "claro" || t === "escuro") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}
export function aplicarTema(t: Tema | null) {
  if (t) document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
}
export function trocarTema(): Tema {
  const novo: Tema = temaAtual() === "escuro" ? "claro" : "escuro";
  aplicarTema(novo);
  try { localStorage.setItem("portal-tema", novo); } catch { /* sem armazenamento: vale só nesta visita */ }
  return novo;
}
