interface Props { className?: string }

export default function EmptyContactsIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/ContactUs.svg"
      alt="Aucun contact"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
