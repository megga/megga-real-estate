// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Share = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17.3999 3C18.8914 3 20.0998 4.20842 20.0998 5.69997C20.0998 7.19152 18.8914 8.39994 17.3999 8.39994C15.9083 8.39994 14.6999 7.19152 14.6999 5.69997C14.6999 4.20842 15.9083 3 17.3999 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.60036 9.29955C8.09191 9.29955 9.30033 10.508 9.30033 11.9995C9.30033 13.4911 8.09191 14.6995 6.60036 14.6995C5.10881 14.6995 3.90039 13.4911 3.90039 11.9995C3.90039 10.508 5.10881 9.29955 6.60036 9.29955Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.3999 15.6001C18.8914 15.6001 20.0998 16.8085 20.0998 18.3C20.0998 19.7906 18.8914 21 17.3999 21C15.9083 21 14.6999 19.7906 14.6999 18.3C14.6999 16.8085 15.9083 15.6001 17.3999 15.6001Z" stroke="currentColor"></path>
<path d="M8.93064 13.3581L15.0778 16.9406M15.0681 7.05859L8.92969 10.6401" stroke="currentColor"></path>
    </svg>
  ),
)

Share.displayName = 'Share'

export default Share
