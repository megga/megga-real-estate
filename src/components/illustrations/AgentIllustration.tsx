interface Props { className?: string }

export default function AgentIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Working-1.svg"
      alt="Agent immobilier"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
