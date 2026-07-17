/** Illustration décorative « vendeur / marketing » (SVG Maggy servi statiquement). */
interface Props { className?: string }

export default function SellerIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Marketing.svg"
      alt="Vendeur"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
