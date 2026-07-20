// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.0515 7.87902C9.0515 9.51346 7.66762 10.8381 6.09243 10.8381C4.51723 10.8381 2.90319 9.46879 3.13335 7.87902C3.36254 6.28926 3.72478 4.66842 3.72478 4.66842C3.94523 3.56132 4.91734 3 6.04678 3H6.02445H17.953C19.0824 3 20.0546 3.56132 20.275 4.66842C20.275 4.66842 20.6372 6.28926 20.8664 7.87902C21.0966 9.46879 19.4826 10.8381 17.9074 10.8381C16.3322 10.8381 14.9483 9.51346 14.9483 7.87902" stroke="currentColor"></path>
<path d="M4.05371 10.1377V18.1234C4.06148 19.7199 5.36184 21.0077 6.9584 20.9999H17.0369C18.6325 21.0096 19.9348 19.7228 19.9436 18.1263V10.1299" stroke="currentColor"></path>
<path d="M9.65137 18.2713V17.0748C9.65137 15.7783 10.7021 14.7266 11.9986 14.7266C13.2951 14.7266 14.3459 15.7783 14.3459 17.0748V18.2713" stroke="currentColor"></path>
<path d="M16.9502 13.6306V13.6206" stroke="currentColor"></path>
<path d="M9.03955 6.95312V7.87863C9.03955 9.51306 10.3642 10.8377 11.9986 10.8377C13.6331 10.8377 14.9577 9.51306 14.9577 7.87863V6.95312" stroke="currentColor"></path>
    </svg>
  ),
)

Store4.displayName = 'Store4'

export default Store4
