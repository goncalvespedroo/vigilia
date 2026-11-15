import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { App } from './App'
import { LimiteDeFalha } from './components/Falha'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LimiteDeFalha>
      <App />
    </LimiteDeFalha>
  </StrictMode>,
)
