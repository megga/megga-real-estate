interface Props { className?: string }

export default function EmptyKycIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Security.svg"
      alt="Aucun dossier KYC"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
