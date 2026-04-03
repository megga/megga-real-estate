interface Props { className?: string }

export default function EmptyMatchingIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/LookingFor.svg"
      alt="Aucun matching"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
