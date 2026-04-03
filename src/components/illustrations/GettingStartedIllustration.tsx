interface Props { className?: string }

export default function GettingStartedIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Idea.svg"
      alt="Premiers pas"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
