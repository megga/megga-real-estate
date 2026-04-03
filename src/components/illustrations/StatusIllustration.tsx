interface Props { className?: string }

export default function StatusIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/AnalyzingChart.svg"
      alt="Statut"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
