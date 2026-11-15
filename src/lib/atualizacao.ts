/**
 * Atualização do PWA (registerType: 'autoUpdate').
 *
 * - Procura versão nova a cada hora (o app fica aberto o dia todo no PC) e
 *   também ao voltar para a janela, se a última checagem passou de 1 hora.
 * - Quando a versão nova assume, NÃO recarrega se o usuário estiver digitando
 *   ou com um formulário (<dialog>) aberto: espera sair do campo, fechar o
 *   diálogo ou a janela ir para segundo plano.
 * - Depois do recarregamento, `versaoAnterior()` informa de qual versão veio.
 */
import { registerSW } from 'virtual:pwa-register'

export const VERSAO_ATUAL = `${__VERSAO__} · build ${__BUILD__}`

const INTERVALO_CHECAGEM = 60 * 60 * 1000
const CHAVE_VERSAO = 'vigilia.versao'

/** Digitando = foco num campo editável com conteúdo; formulário = <dialog> aberto. */
export function ocupado(): boolean {
  if (document.querySelector('dialog[open]')) return true
  const el = document.activeElement
  if (el instanceof HTMLTextAreaElement) return el.value.trim() !== ''
  if (el instanceof HTMLInputElement) {
    const editavel = !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(el.type)
    return editavel && el.value.trim() !== ''
  }
  return el instanceof HTMLElement && el.isContentEditable
}

let iniciado = false

export function iniciarAtualizacao(aoFicarOffline?: () => void) {
  if (iniciado) return // StrictMode monta duas vezes em dev
  iniciado = true

  let pendente = false
  let ultimaChecagem = Date.now()

  const tentarRecarregar = () => {
    if (!pendente || ocupado()) return
    pendente = false
    window.location.reload()
  }
  // Rede de segurança: o campo pode esvaziar sem perder o foco (captura após Enter).
  setInterval(tentarRecarregar, 30_000)

  // focusout dispara antes de o foco mudar; checa no próximo ciclo.
  document.addEventListener('focusout', () => setTimeout(tentarRecarregar, 0))
  // 'close' de <dialog> não borbulha: escuta na captura.
  document.addEventListener('close', () => setTimeout(tentarRecarregar, 0), true)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') tentarRecarregar()
    else if (Date.now() - ultimaChecagem > INTERVALO_CHECAGEM) void checar()
  })

  let registro: ServiceWorkerRegistration | undefined
  const checar = async () => {
    if (!registro || registro.installing || !navigator.onLine) return
    ultimaChecagem = Date.now()
    try {
      await registro.update()
    } catch {
      // sem rede ou servidor fora: tenta na próxima
    }
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registro = r
      if (r) setInterval(() => void checar(), INTERVALO_CHECAGEM)
    },
    onNeedReload() {
      pendente = true
      tentarRecarregar()
    },
    onOfflineReady: aoFicarOffline,
  })
}

/**
 * Registra a versão em execução e devolve a anterior, se for diferente
 * (ou seja: o sistema acabou de ser atualizado). Chamar uma vez por carga.
 */
export function versaoAnterior(): string | null {
  try {
    const anterior = localStorage.getItem(CHAVE_VERSAO)
    localStorage.setItem(CHAVE_VERSAO, VERSAO_ATUAL)
    return anterior && anterior !== VERSAO_ATUAL ? anterior : null
  } catch {
    return null
  }
}
