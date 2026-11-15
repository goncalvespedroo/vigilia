export function Emblema({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="var(--c-destaque)" strokeWidth="1.6">
      <circle cx="20" cy="20" r="18" />
      <circle cx="20" cy="20" r="12" strokeDasharray="2 3" />
      <path d="M8 20 Q20 9 32 20 Q20 31 8 20 Z" />
      <line x1="20" y1="14" x2="20" y2="26" strokeWidth="2.4" />
    </svg>
  )
}
