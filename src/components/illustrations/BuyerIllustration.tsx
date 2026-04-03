interface Props { className?: string }

export default function BuyerIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Buy.svg"
      alt="Acheteur"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
