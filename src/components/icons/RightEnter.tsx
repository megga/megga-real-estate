// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RightEnter = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M15.6055 20.0957L17.4055 20.0957C19.3955 20.0957 21.0055 18.4827 21.0055 16.4957L21.0055 7.4957C21.0055 5.5077 19.3955 3.89569 17.4055 3.89569L15.6055 3.89569" stroke="currentColor"></path>
<path d="M15.125 14.2754L17.405 11.9964L15.125 9.7164" stroke="currentColor"></path>
<path d="M5.49609 20.0957C4.11538 20.0957 2.99609 18.9764 2.99609 17.5957L2.99609 6.39648C2.99609 5.01577 4.11538 3.89648 5.49609 3.89648L7.66662 3.89648C9.04733 3.89648 10.1666 5.01577 10.1666 6.39648L10.1666 17.5957C10.1666 18.9764 9.04733 20.0957 7.66662 20.0957L5.49609 20.0957Z" stroke="currentColor"></path>
<path d="M10.1758 11.9961L17.4015 11.9961" stroke="currentColor"></path>
    </svg>
  ),
)

RightEnter.displayName = 'RightEnter'

export default RightEnter
