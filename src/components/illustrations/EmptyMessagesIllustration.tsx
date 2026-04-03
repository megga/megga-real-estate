interface Props { className?: string }

export default function EmptyMessagesIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/EmptyState.svg"
      alt="Aucun message"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
