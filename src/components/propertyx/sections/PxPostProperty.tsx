// MEGGA Marketplace — Property X "Post a property" section.
// Source : Figma Home V3 (node 9552:21432) — "Post a free property" + "Post a paid property".
// Layout : 2 cards côte à côte sur fond clair, avec un bouton "+" circulaire à droite.

import { PX, PxCircleButton, PxIcon } from '..'

interface Card {
  id: string
  title: string
  description: string
  href: string
}

const CARDS: Card[] = [
  {
    id: 'free',
    title: 'Publier une annonce gratuite',
    description:
      'Mettez votre bien en ligne en quelques minutes. Idéal pour les particuliers qui souhaitent toucher la communauté MEGGA.',
    href: '/publier?type=free',
  },
  {
    id: 'paid',
    title: 'Publier une annonce premium',
    description:
      'Visibilité accrue, mise en avant sur la page d\'accueil, photos pro et accompagnement par un agent dédié.',
    href: '/publier?type=premium',
  },
]

function PostCard({ c }: { c: Card }) {
  return (
    <a
      href={c.href}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
        padding: 32,
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        border: `1px solid ${PX.border}`,
        boxShadow: PX.shadow.small,
        textDecoration: 'none',
        color: 'inherit',
        transition: `box-shadow ${PX.duration.base} ${PX.ease}`,
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 24,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            fontWeight: 500,
            color: PX.ink,
          }}
        >
          {c.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '-0.42px',
            color: PX.inkSoft,
            maxWidth: 380,
          }}
        >
          {c.description}
        </p>
      </div>

      <PxCircleButton size="lg" variant="dark" ariaLabel={c.title}>
        <PxIcon name="plus" size={16} color={PX.inkInverse} />
      </PxCircleButton>
    </a>
  )
}

export default function PxPostProperty() {
  return (
    <section
      style={{
        background: PX.pageBg,
        padding: `${PX.sectionPadding.default}px ${PX.space.pageX}px`,
      }}
    >
      <div
        style={{
          maxWidth: PX.containerDesktop,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: PX.gap.lg,
        }}
      >
        {CARDS.map((c) => (
          <PostCard key={c.id} c={c} />
        ))}
      </div>
    </section>
  )
}
