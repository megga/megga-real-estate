interface Props { className?: string }

export default function PlansIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/SelectaPlan.svg"
      alt="Plans"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
