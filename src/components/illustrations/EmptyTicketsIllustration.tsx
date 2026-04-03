interface Props { className?: string }

export default function EmptyTicketsIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Feedback.svg"
      alt="Aucun ticket"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
