// Aviso "Nova versão do portal disponível": quem deixa a aba aberta por dias continuaria vendo a versão antiga.
// A cada 5 minutos (e quando a pessoa volta para a aba) o portal confere se o site publicado mudou; se mudou, mostra o aviso.
import { useEffect, useState } from "react";

const scriptAtual = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute("src") || "";

export function NovaVersao() {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    const atual = scriptAtual();
    if (!atual) return; // ambiente de desenvolvimento
    let parado = false;
    const conferir = async () => {
      if (parado || document.visibilityState !== "visible") return;
      try {
        const html = await (await fetch(`/?v=${Date.now()}`, { cache: "no-store" })).text();
        const m = /<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/.exec(html) || /<script[^>]+src="([^"]*\/assets\/[^"]+)"[^>]*type="module"/.exec(html);
        if (m && m[1] !== atual) setNova(true);
      } catch { /* sem internet: tenta de novo depois */ }
    };
    const t = window.setInterval(conferir, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", conferir);
    return () => { parado = true; window.clearInterval(t); document.removeEventListener("visibilitychange", conferir); };
  }, []);
  if (!nova) return null;
  return (
    <div role="status" style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 100000, display: "flex", alignItems: "center", gap: 14,
      background: "var(--p-text)", color: "var(--p-bg)", borderRadius: 980, padding: "10px 10px 10px 20px", boxShadow: "0 12px 32px rgba(0,0,0,.28)",
      fontSize: 14.5, fontWeight: 600, maxWidth: "calc(100vw - 32px)" }}>
      <span>Nova versão do portal disponível</span>
      <button onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 980, background: "var(--p-accent)", color: "var(--p-on-accent)",
        padding: "8px 16px", font: "inherit", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Atualizar</button>
    </div>
  );
}
