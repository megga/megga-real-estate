interface Props { className?: string }

export default function LoginIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Welcome.svg"
      alt="Connexion"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
