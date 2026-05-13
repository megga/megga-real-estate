// MEGGA Marketplace — Property X "Read our latest articles" section.
// Source : Figma Home V3 (node 9552:21432) — section "Our Blog".
// Layout : 2 cards horizontales côte à côte, image en haut, contenu en bas
// avec badge catégorie + date + bouton circulaire flèche.

import { PX, PxBadge, PxCircleButton, PxIcon, PxSectionLabel } from '..'

const ARTICLES = [
  {
    id: 'a1',
    category: 'Ressources',
    title: 'Acheter ou louer en Suisse : le guide complet 2026',
    date: '18 mars 2026',
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=80',
    href: '/blog/acheter-ou-louer-2026',
  },
  {
    id: 'a2',
    category: 'Blog',
    title: 'Combien de chambres et de salles de bain choisir pour sa famille ?',
    date: '12 mars 2026',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1600&q=80',
    href: '/blog/combien-de-chambres',
  },
]

function ArticleCard({ a }: { a: (typeof ARTICLES)[0] }) {
  return (
    <a
      href={a.href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        boxShadow: PX.shadow.small,
        border: `1px solid ${PX.border}`,
      }}
    >
      {/* Image */}
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 10',
          backgroundImage: `url("${a.image}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Contenu */}
      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 20,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            fontWeight: 500,
            color: PX.ink,
          }}
        >
          {a.title}
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PxBadge variant="primary" size="sm">
              {a.category}
            </PxBadge>
            <span
              style={{
                fontFamily: PX.font.display,
                fontSize: 13,
                letterSpacing: '-0.4px',
                color: PX.inkMuted,
              }}
            >
              {a.date}
            </span>
          </div>

          <PxCircleButton size="sm" variant="dark" ariaLabel="Lire l'article">
            <PxIcon name="arrow-right" size={14} color={PX.inkInverse} />
          </PxCircleButton>
        </div>
      </div>
    </a>
  )
}

export default function PxBlogTeaser() {
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
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          <PxSectionLabel>Notre blog</PxSectionLabel>
          <h2
            style={{
              margin: '16px 0 0 0',
              fontFamily: PX.font.display,
              fontSize: 40,
              lineHeight: 1.18,
              letterSpacing: '-1.2px',
              fontWeight: 500,
              color: PX.ink,
            }}
          >
            Lisez nos derniers articles
          </h2>
        </div>

        {/* 2 cards horizontales */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: PX.gap.lg,
          }}
        >
          {ARTICLES.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>

        {/* Lien "Voir tous les articles" */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 32,
          }}
        >
          <a
            href="/blog"
            style={{
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.42px',
              color: PX.ink,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Voir tous les articles
            <PxIcon name="arrow-right" size={14} />
          </a>
        </div>
      </div>
    </section>
  )
}
