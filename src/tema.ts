// Tema claro/escuro do portal. O padrão é o claro; quem quiser troca para o escuro no botão do topo (fica salvo).
export type Tema = "claro" | "escuro";

export function temaSalvo(): Tema | null {
  try { const t = localStorage.getItem("portal-tema"); return t === "claro" || t === "escuro" ? t : null; } catch { return null; }
}
export function temaAtual(): Tema {
  const t = document.documentElement.dataset.tema as Tema | undefined;
  return t === "escuro" ? "escuro" : "claro";
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
