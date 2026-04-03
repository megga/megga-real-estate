interface Props { className?: string }

export default function EmptyPipelineIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/ProjectManagement.svg"
      alt="Aucun deal"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
