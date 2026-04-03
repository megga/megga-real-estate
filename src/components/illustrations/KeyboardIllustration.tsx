interface Props { className?: string }

export default function KeyboardIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/WorkinginSpace.svg"
      alt="Raccourcis"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
