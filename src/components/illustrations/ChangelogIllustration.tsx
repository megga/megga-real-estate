interface Props { className?: string }

export default function ChangelogIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Alarm.svg"
      alt="Nouveautés"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
