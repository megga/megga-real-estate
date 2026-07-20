// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PieChart4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.6067 3.62924C6.36232 3.89668 3 7.54242 3 12.0006C3 14.8226 4.34726 17.3191 6.41268 18.8393C7.61024 19.7207 9.04924 20.2738 10.607 20.3719C10.8829 20.3893 11.1072 20.1636 11.1072 19.8872V4.11399C11.1072 3.83758 10.8825 3.61185 10.6067 3.62924Z" stroke="currentColor"></path>
<path d="M20.9989 14.1445C21.0191 13.8689 20.7931 13.6443 20.5167 13.6443H14.7744C14.498 13.6443 14.2739 13.8684 14.2739 14.1448V19.8871C14.2739 20.1635 14.4983 20.3895 14.774 20.3693C15.4143 20.3224 16.0299 20.186 16.6081 19.9727C19.0328 19.078 20.802 16.8297 20.9989 14.1445Z" stroke="currentColor"></path>
<path d="M20.5167 10.3567C20.7931 10.3567 21.0191 10.1319 20.9989 9.85621C20.7549 6.53099 18.0996 3.87572 14.7744 3.63175C14.4988 3.61153 14.2739 3.83753 14.2739 4.11393V9.85625C14.2739 10.1326 14.498 10.3567 14.7744 10.3567H20.5167Z" stroke="currentColor"></path>
    </svg>
  ),
)

PieChart4.displayName = 'PieChart4'

export default PieChart4
