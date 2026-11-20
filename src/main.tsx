import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { aplicarTema, temaSalvo } from './tema'
aplicarTema(temaSalvo() || "claro")
import App from './App.tsx'
import { NovaVersao } from './NovaVersao'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <NovaVersao />
  </StrictMode>,
)

// Tira a tela de abertura do app instalado quando o portal já desenhou a primeira tela
// (fica no mínimo ~1,2 s para a marca aparecer com calma; no navegador comum ela nem aparece).
const abertura = document.getElementById("abertura");
if (abertura) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const espera = Math.max(0, 1200 - performance.now()); // performance.now() = tempo desde que o app abriu
    window.setTimeout(() => { abertura.classList.add("saindo"); window.setTimeout(() => abertura.remove(), 500); }, getComputedStyle(abertura).display === "none" ? 0 : espera);
  }));
}
