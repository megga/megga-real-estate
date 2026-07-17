/** Illustration décorative « support / FAQ » (SVG Maggy servi statiquement). */
interface Props { className?: string }

export default function SupportIllustration({ className = 'w-full h-full' }: Props) {
  return (
    <img
      src="/illustrations/maggy/FAQ.svg"
      alt="Support"
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}
