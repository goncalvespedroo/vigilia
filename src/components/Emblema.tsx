export function Emblema({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="var(--accent)" strokeWidth="1.3">
      <circle cx="20" cy="20" r="18.5" stroke="var(--warning)" />
      <circle cx="20" cy="20" r="13" strokeDasharray="1.5 2.5" />
      <path d="M7 20 Q20 8.5 33 20 Q20 31.5 7 20 Z" />
      <circle cx="20" cy="20" r="3.2" fill="var(--accent)" />
    </svg>
  )
}
