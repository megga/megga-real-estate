// MEGGA Marketplace — Property X "📱 Icons" styleguide section.
// Source : Figma node 11723:19978 — code Figma EXACT.
//
// Page UI Kit Icons : shell partagé + showcase "Social Media Square Icons" —
// 33 plateformes × 2 variantes (colored + monochrome) = 66 rounded squares 24×24.
//
// Utilise les SVGs téléchargés depuis Figma (/public/icons/social/<brand>-<variant>.svg)
// pour pixel-perfect fidélité, plutôt que les paths hand-written de PxSocialIcon.
//
// Bug Figma corrigé : titre interne disait "Lists" (template dupliqué) → "Icons".

import { PX, PX_SOCIAL_BRAND_COLORS } from '..'
import type { PxSocialIconName } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

// ─── Ordre Figma exact ────────────────────────────────────────────────
const SOCIAL_ORDER: PxSocialIconName[] = [
  'facebook', 'twitter', 'instagram', 'linkedin', 'youtube',
  'dribbble', 'behance', 'whatsapp', 'tiktok', 'google',
  'spotify', 'product-hunt', 'yelp', 'twitch', 'tumblr',
  'vk', 'line', 'soundcloud', 'github', 'messenger',
  'reddit', 'pinterest', 'telegram', 'medium', 'snapchat',
  'discord', 'skype', 'google-podcast', 'apple-podcast', 'apple',
  'google-play', 'wechat', 'apple-music',
]

// ─── Bg spécial pour icônes multi-couleurs (Google, Google Play, Google Podcast) ─
// Ces icônes ont une variante colorée multi-color qui ne se voit pas sur fond brand.
// Figma : bg white avec border 0.5 white.
const WHITE_BG_BRANDS = new Set<PxSocialIconName>([
  'google',
  'google-play',
  'google-podcast',
])

// ─── Gradients spéciaux pour la variante colorée (depuis Figma) ──────
const GRADIENTS: Partial<Record<PxSocialIconName, string>> = {
  instagram:    'linear-gradient(-45deg, #FBE18A 0%, #FCBB45 21%, #F75274 38%, #D53692 52%, #8F39CE 74%, #5B4FE9 100%)',
  soundcloud:   'linear-gradient(180.9deg, #FF433A 0.84%, #FF9436 99.16%)',
  skype:        'linear-gradient(135deg, #00C3FF 0%, #0092DD 100%)',
  messenger:    'linear-gradient(180deg, #00B1FF 0%, #006BFF 100%)',
  telegram:     'linear-gradient(180deg, #00ACFF 0%, #0098E1 100%)',
  'apple-podcast': 'linear-gradient(180deg, #D272F7 0%, #8433BE 100%)',
  'apple-music':   'linear-gradient(0deg, #FA233B 0%, #FB5C74 100%)',
}

// ─── 24×24 rounded square avec bg + SVG centré ────────────────────────
function SocialIconSquare({ name, colored }: { name: PxSocialIconName; colored: boolean }) {
  let bg: string
  let border: string | undefined

  if (colored) {
    if (WHITE_BG_BRANDS.has(name)) {
      bg = PX.neutral100
      border = `0.5px solid ${PX.neutral100}`
    } else if (GRADIENTS[name]) {
      bg = GRADIENTS[name] as string
    } else {
      bg = PX_SOCIAL_BRAND_COLORS[name]
    }
  } else {
    bg = PX.neutral700
  }

  const src = `/icons/social/${name}-${colored ? 'colored' : 'mono'}.svg`

  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        background: bg,
        border,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={name}
        style={{
          width: 16,
          height: 16,
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </span>
  )
}

// ─── Showcase : 33×2 icons en grille flex-wrap ────────────────────────
function IconsShowcase() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 40,
        border: `1.5px dashed ${PX.neutral500}`,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.regular,
        background: PX.pageBg,
        width: '100%',
        maxWidth: 920,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {SOCIAL_ORDER.map(name => (
          <SocialIconSquare key={`c-${name}`} name={name} colored />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {SOCIAL_ORDER.map(name => (
          <SocialIconSquare key={`m-${name}`} name={name} colored={false} />
        ))}
      </div>
    </div>
  )
}

export default function PxIconsStyleGuide() {
  return (
    <PxStyleguideShell selected="icons" title="Icons" iconName="icons-regular">
      <div data-node-id="11723:19986" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 40 }}>
        <PxStyleguideSectionTitle title="Social Media Square Icons" />
        <IconsShowcase />
      </div>
    </PxStyleguideShell>
  )
}
