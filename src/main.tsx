import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { aplicarTema, temaSalvo } from './tema'
aplicarTema(temaSalvo() || "claro")
import App from './App.tsx'
import { NovaVersao } from './NovaVersao'
import { lembrarPosicao } from './posicao'
lembrarPosicao()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <NovaVersao />
  </StrictMode>,
)

// Tira a tela de abertura do app instalado quando o portal já desenhou a primeira tela
// (fica no mínimo ~5,8 s: a linha verde completa o caminho para a marca aparecer com calma; no navegador comum ela nem aparece).
const abertura = document.getElementById("abertura");
if (abertura) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const espera = Math.max(0, 5800 - performance.now()); // performance.now() = tempo desde que o app abriu
    window.setTimeout(() => { abertura.classList.add("saindo"); window.setTimeout(() => abertura.remove(), 1000); }, getComputedStyle(abertura).display === "none" ? 0 : espera);
  }));
}
