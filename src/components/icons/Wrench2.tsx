// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Wrench2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.1518 21V17.8643C15.1518 17.5806 15.2656 17.3091 15.467 17.1088L18.7653 13.846C19.3642 13.2533 19.7008 12.447 19.7008 11.6051V7.35808C19.7008 6.40334 19.2676 5.50045 18.5244 4.90259L16.3658 3.16596C15.8777 2.77349 15.1518 3.12122 15.1518 3.74755V7.98644C15.1518 8.46533 14.9027 8.90966 14.4939 9.15978L12.7187 10.2467C12.2774 10.5161 11.7222 10.5161 11.282 10.2467L9.50568 9.15978C9.09694 8.90966 8.84783 8.46533 8.84783 7.98644V3.74755C8.84783 3.12122 8.12186 2.77349 7.63381 3.16596L5.47624 4.90259C4.73197 5.50045 4.29883 6.40334 4.29883 7.35808V11.6051C4.29883 12.447 4.63538 13.2533 5.23425 13.846L8.53263 17.1088C8.73395 17.3091 8.84783 17.5806 8.84783 17.8643V21" stroke="currentColor"></path>
    </svg>
  ),
)

Wrench2.displayName = 'Wrench2'

export default Wrench2
