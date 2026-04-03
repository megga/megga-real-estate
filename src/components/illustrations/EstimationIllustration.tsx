interface Props { className?: string }

export default function EstimationIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/Calculate.svg"
      alt="Estimation"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
