import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import { RotaProtegida } from './components/RotaProtegida'
import { Layout } from './components/Layout'
import { Entrar } from './pages/Entrar'
import { Painel } from './pages/Painel'
import { Hoje } from './pages/Hoje'
import { Operacoes } from './pages/Operacoes'
import { Agentes } from './pages/Agentes'
import { Reunioes } from './pages/Reunioes'
import { ReuniaoDossie } from './pages/ReuniaoDossie'
import { Calendario } from './pages/Calendario'
import { DadosProvider } from './lib/dados'
import { AtualizacaoPWA } from './components/AtualizacaoPWA'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route element={<RotaProtegida />}>
            <Route
              element={
                <DadosProvider>
                  <Layout />
                </DadosProvider>
              }
            >
              <Route index element={<Painel />} />
              <Route path="hoje" element={<Hoje />} />
              <Route path="operacoes" element={<Operacoes />} />
              <Route path="calendario" element={<Calendario />} />
              <Route path="reunioes" element={<Reunioes />} />
              <Route path="reunioes/:id" element={<ReuniaoDossie />} />
              <Route path="agentes" element={<Agentes />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <AtualizacaoPWA />
    </AuthProvider>
  )
}
