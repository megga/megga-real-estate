// MEGGA Marketplace — Property X design system exports.
//
// Référence : page Components du fichier Figma Property X (BRIX Templates).
// Source : variables Figma extraites (couleurs Neutrals, font Objectivity,
// spacings, radii, shadows).
//
// 10 atomes du DS Property X + tokens centraux :

export { PX, type PxPalette } from './tokens'

// Buttons
export { default as PxButton, PxArrowRight, PxCircleButton } from './PxButton'
export type { PxButtonVariant, PxButtonSize } from './PxButton'

// Badges
export { default as PxBadge } from './PxBadge'
export type { PxBadgeVariant, PxBadgeSize } from './PxBadge'

// Inputs
export {
  PxInput,
  PxSelect,
  PxTextArea,
  PxCheckbox,
  PxRadio,
  PxToggle,
} from './PxInput'

// Avatars
export { default as PxAvatar } from './PxAvatar'
export type { PxAvatarSize } from './PxAvatar'

// Links
export { default as PxLink } from './PxLink'
export type { PxLinkVariant, PxLinkWeight } from './PxLink'

// Logo
export { default as PxLogo } from './PxLogo'
export type { PxLogoVariant, PxLogoForm, PxLogoSize } from './PxLogo'

// Icons (line-style stroke)
export { default as PxIcon } from './PxIcon'
export type { PxIconName } from './PxIcon'

// Icon font (filled variant)
export { default as PxIconFont } from './PxIconFont'
export type { PxIconFontName } from './PxIconFont'

// Social Media Icons (correspond au frame Figma 📱 Icons)
export { default as PxSocialIcon, PX_SOCIAL_BRAND_COLORS } from './PxSocialIcon'
export type { PxSocialIconName } from './PxSocialIcon'

// Images
export { default as PxImage } from './PxImage'
export type { PxImageRadius, PxImageRatio } from './PxImage'

// Upload Card (atome des Inputs, distinct du PxInput)
export { default as PxUploadCard } from './PxUploadCard'
export type { PxUploadCardVariant } from './PxUploadCard'

// Lists
export { PxList, PxListItem } from './PxList'

// Section label (eyebrow uppercase)
export { default as PxSectionLabel } from './PxSectionLabel'
