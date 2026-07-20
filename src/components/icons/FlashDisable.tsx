// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashDisable = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.6504 13.5637L20.2106 10.6414C20.5365 10.2695 20.2724 9.68691 19.7779 9.68691H15.0901C14.693 9.68691 14.4153 9.2942 14.5476 8.91982L16.7431 3.76709C16.8754 3.39271 16.5977 3 16.2006 3H11.2361C10.9948 3 10.7791 3.15062 10.696 3.3772L9.42969 6.46694" stroke="currentColor"></path>
<path d="M3.64453 5.03516L19.6085 20.9992" stroke="currentColor"></path>
<path d="M8.16348 9.55859L6.99273 12.4153C6.85499 12.7907 7.13292 13.1888 7.53289 13.1888H11.462C11.8401 13.1888 12.1154 13.5471 12.018 13.9123L10.3212 20.2754C10.1644 20.8635 10.9088 21.2606 11.3099 20.8028L15.0902 16.4879" stroke="currentColor"></path>
    </svg>
  ),
)

FlashDisable.displayName = 'FlashDisable'

export default FlashDisable
