// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HomeKey2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.49658 9.22797V17.903C4.49658 19.595 5.86847 20.9669 7.56047 20.9669H16.4398C18.1318 20.9669 19.5037 19.595 19.5037 17.903V9.22797" stroke="currentColor"></path>
<path d="M21 10.4087L13.4741 4.45124C12.6101 3.76821 11.3899 3.76821 10.5259 4.45124L3 10.4087" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.3264 12.3031C13.0307 13.0074 14.171 13.007 14.8748 12.3032C15.5786 11.5993 15.5791 10.459 14.8748 9.75476C14.1712 9.05119 13.0302 9.0509 12.3264 9.75476L12.3236 9.75752C11.6226 10.4614 11.6243 11.6009 12.3264 12.3031Z" stroke="currentColor"></path>
<path d="M12.2946 12.3392L8.28125 16.3525L9.55546 17.6268" stroke="currentColor"></path>
<path d="M11.5008 15.6808L10.2266 14.4066" stroke="currentColor"></path>
    </svg>
  ),
)

HomeKey2.displayName = 'HomeKey2'

export default HomeKey2
