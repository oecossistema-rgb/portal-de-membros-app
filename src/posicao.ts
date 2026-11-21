// Ao atualizar a página, volta para o mesmo ponto onde a pessoa estava (em qualquer aba, inclusive dentro da galeria).
// Guarda a rolagem por endereço (#aba) só nesta aba do navegador; ao recarregar, espera o conteúdo carregar e rola de volta.
// Se a pessoa tocar ou rolar antes, desiste (não briga com ela).
const CHAVE = "portal-posicao";
const ROLAVEIS = ".gal-corpo"; // áreas com rolagem própria

type Salvo = { h: string; y: number; dentro: number[] };

function ler(): Salvo | null {
  try { return JSON.parse(sessionStorage.getItem(CHAVE) || "null"); } catch { return null; }
}
function salvar() {
  try {
    const dentro = [...document.querySelectorAll<HTMLElement>(ROLAVEIS)].map((el) => el.scrollTop);
    sessionStorage.setItem(CHAVE, JSON.stringify({ h: location.hash, y: window.scrollY, dentro }));
  } catch { /* sem armazenamento: segue normal */ }
}

export function lembrarPosicao() {
  try { history.scrollRestoration = "manual"; } catch { /* */ }
  const salvo = ler();

  let t = 0;
  const agendar = () => { window.clearTimeout(t); t = window.setTimeout(salvar, 150); };
  window.addEventListener("scroll", agendar, { passive: true });
  document.addEventListener("scroll", (e) => { if ((e.target as Element)?.matches?.(ROLAVEIS)) agendar(); }, { capture: true, passive: true });
  window.addEventListener("pagehide", salvar);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") salvar(); });

  if (!salvo || salvo.h !== location.hash || (salvo.y < 5 && !salvo.dentro?.some((v) => v > 5))) return;
  let desistiu = false;
  const parar = () => { desistiu = true; };
  ["touchstart", "wheel", "keydown", "mousedown"].forEach((ev) => window.addEventListener(ev, parar, { once: true, passive: true }));
  const inicio = performance.now();
  const tentar = () => {
    if (desistiu) return;
    let ok = true;
    if (salvo.y > 5) {
      if (document.documentElement.scrollHeight - window.innerHeight >= salvo.y - 2) window.scrollTo(0, salvo.y);
      ok = Math.abs(window.scrollY - salvo.y) < 4;
    }
    const els = [...document.querySelectorAll<HTMLElement>(ROLAVEIS)];
    (salvo.dentro || []).forEach((v, i) => {
      const el = els[i];
      if (!v) return;
      if (!el) { ok = false; return; }
      el.scrollTop = v;
      if (Math.abs(el.scrollTop - v) > 4) ok = false;
    });
    // Continua tentando enquanto fotos e listas terminam de carregar (até ~8 s).
    if (!ok && performance.now() - inicio < 8000) window.setTimeout(tentar, 120);
  };
  window.setTimeout(tentar, 60);
}
