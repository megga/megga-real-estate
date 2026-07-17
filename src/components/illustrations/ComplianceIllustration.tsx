/** Illustration Maggy « conformité » (bouclier, SVG statique). */
interface Props { className?: string }

export default function ComplianceIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/element-Shield.svg"
      alt="Conformité"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
