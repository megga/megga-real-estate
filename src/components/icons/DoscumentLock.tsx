// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DoscumentLock = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M13.785 3.28323C14.343 3.28323 14.877 3.51124 15.264 3.91424L19.055 7.86325C19.421 8.24425 19.627 8.75323 19.627 9.28323V17.4482C19.64 19.5032 18.023 21.2002 15.969 21.2832C15.969 21.2832 8.07402 21.2832 8.04302 21.2822C5.97102 21.2372 4.32797 19.5202 4.37297 17.4482V6.94122C4.42197 4.90122 6.09402 3.27523 8.13402 3.28323H13.785Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.2747 17.168H10.5387C9.7887 17.168 9.18066 16.56 9.18066 15.81V14.274C9.18066 13.524 9.7887 12.916 10.5387 12.916H13.2747C14.0247 12.916 14.6337 13.524 14.6337 14.274V15.81C14.6337 16.56 14.0247 17.168 13.2747 17.168Z" stroke="currentColor"></path>
<path d="M13.5404 12.9425V11.9315C13.5284 11.0295 12.7894 10.3075 11.8874 10.3185C11.0034 10.3295 10.2884 11.0405 10.2744 11.9245V12.9425" stroke="currentColor"></path>
<path d="M14.2686 3.3457V6.23871C14.2676 7.64971 15.4106 8.79568 16.8226 8.79968H19.5616" stroke="currentColor"></path>
    </svg>
  ),
)

DoscumentLock.displayName = 'DoscumentLock'

export default DoscumentLock
