/** Estado de carregamento: varredura ciano + linhas fantasma (sistema de design · 06). */
export function Carregando({ rotulo = 'DECODIFICANDO ARQUIVO…' }: { rotulo?: string }) {
  return (
    <div className="carregando" role="status" aria-busy="true">
      <span className="carregando__rotulo">{rotulo}</span>
      <div className="carregando__trilho" />
      <div className="carregando__fantasma" style={{ width: '80%' }} />
      <div className="carregando__fantasma" style={{ width: '55%' }} />
    </div>
  )
}
