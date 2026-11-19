import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { aplicarTema, temaSalvo } from './tema'
aplicarTema(temaSalvo())
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
