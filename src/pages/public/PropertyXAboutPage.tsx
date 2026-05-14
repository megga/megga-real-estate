// MEGGA Marketplace — Page À propos (port fidèle Figma node 9552:21435).
// Structure : Hero + Value + Mission + Offices + Team + Follow.

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooter from '@/components/propertyx/sections/PxFooter'
import PxButton from '@/components/propertyx/PxButton'
import PxIcon from '@/components/propertyx/PxIcon'

// ─── Filled icons (style monochrome solide, fidèle aux icônes Figma de la maquette) ──
type FilledIconName = 'bulb' | 'star' | 'chart' | 'team' | 'chat' | 'flag' | 'user' | 'home'

function FilledIcon({ name, size = 28, color = PX.neutral700 }: { name: FilledIconName; size?: number; color?: string }) {
  const paths: Record<FilledIconName, React.ReactNode> = {
    bulb: (
      <>
        <path d="M9 21h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 22.5V21Z" />
        <path d="M12 2a7 7 0 0 0-4.2 12.6c.7.5 1.2 1.2 1.2 2.1V18h6v-1.3c0-.9.5-1.6 1.2-2.1A7 7 0 0 0 12 2Z" />
      </>
    ),
    star: <path d="M12 2.5 14.7 9 22 9.6l-5.4 4.7L18 22l-6-3.4L6 22l1.4-7.7L2 9.6 9.3 9 12 2.5Z" />,
    chart: (
      <>
        <rect x="3" y="14" width="4" height="8" rx="1" />
        <rect x="10" y="9" width="4" height="13" rx="1" />
        <rect x="17" y="4" width="4" height="18" rx="1" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <circle cx="17" cy="10" r="2.6" />
        <path d="M2.5 19.5c.5-3.4 3-5.5 6.5-5.5s6 2.1 6.5 5.5v.5h-13v-.5Z" />
        <path d="M16.5 14.5c2.5 0 4.2 1.4 4.8 4v.5h-4.6c-.1-1.7-.5-3.2-1.4-4.4.3 0 .8-.1 1.2-.1Z" />
      </>
    ),
    chat: (
      <>
        <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9.5L6 22v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      </>
    ),
    flag: (
      <>
        <path d="M5 3v19" strokeWidth="2.4" stroke={color} fill="none" strokeLinecap="round" />
        <path d="M5 3h12.5l-2.4 4.5L17.5 12H5V3Z" />
      </>
    ),
    // User filled (silhouette personne) — pour badge "Our mission"
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8H4Z" />
      </>
    ),
    // Home filled (maison simplifiée) — pour badges "Our agents" et "Follow us"
    home: (
      <path d="M12 2.5 3 10v11h6v-6h6v6h6V10L12 2.5Z" />
    ),
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" style={{ display: 'inline-block', flexShrink: 0 }}>
      {paths[name]}
    </svg>
  )
}

// ─── Badge eyebrow (fidèle Figma : bg neutral300 + cercle 26px neutral400 + icône blanche filled) ──
function EyebrowBadge({
  text,
  iconName,
  invert = false,
}: {
  text: string
  iconName: FilledIconName
  invert?: boolean
}) {
  // En invert (sur fond noir) : pill blanc 8% + cercle blanc 16%
  const pillBg = invert ? 'rgba(255,255,255,0.08)' : PX.neutral300
  const circleBg = invert ? 'rgba(255,255,255,0.16)' : PX.neutral400
  const textColor = invert ? PX.neutral100 : PX.neutral700
  const iconColor = PX.neutral100

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 6,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        background: pillBg,
        borderRadius: PX.radius.pill,
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: PX.radius.pill,
          background: circleBg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <FilledIcon name={iconName} size={14} color={iconColor} />
      </span>
      <span
        style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: textColor,
          paddingTop: 2,
        }}
      >
        {text}
      </span>
    </span>
  )
}

// ─── Link avec chevron (pour "Post properties", "Browse all agents") ────────
function PxTextLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <a
      href={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        textDecoration: 'none',
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}
    >
      <span style={{ paddingTop: 2 }}>{children}</span>
      <PxIcon name="chevron-right" size={16} color={PX.neutral700} strokeWidth={2} />
    </a>
  )
}

// ─── Section 1 — Hero ────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      style={{
        padding: '64px 24px 80px',
        background: PX.neutral100,
      }}
    >
      <div style={{ maxWidth: 1392, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 56 }}>
        {/* Top Content : H1 à gauche + paragraphe/CTA à droite */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            padding: '0 104.5px',
            gap: 64,
          }}
        >
          <h1
            style={{
              margin: 0,
              width: 613,
              fontFamily: PX.font.display,
              fontSize: 72,
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: '-2.16px',
              color: PX.neutral700,
            }}
          >
            À propos de notre agence
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', width: 585 }}>
            <div style={{ paddingTop: 16 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  letterSpacing: '-0.48px',
                  color: PX.neutral500,
                }}
              >
                MEGGA réunit 33 000 biens, 26 cantons et 4 langues sur une plateforme transparente, conçue pour vous accompagner de la recherche à la signature, en toute confiance.
              </p>
            </div>
            <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <PxButton to="/acheter" variant="primary" size="lg">
                Commencer
              </PxButton>
              <PxTextLink to="/publier">Publier un bien</PxTextLink>
            </div>
          </div>
        </div>

        {/* Bottom Content : image carrée + stats à gauche, grande image à droite */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {/* Colonne gauche : image + stats, alignées à droite */}
          <div
            style={{
              width: 596,
              height: 662,
              display: 'flex',
              flexDirection: 'column',
              gap: 56,
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              flexShrink: 0,
            }}
          >
            {/* Image 596×442 */}
            <div
              style={{
                width: 596,
                height: 442,
                borderRadius: PX.radius.large,
                overflow: 'hidden',
                backgroundImage:
                  'url("https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=85")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Stats Wrapper 462×164, alignée à droite */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
              {/* Stat 1 : Biens vendus */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 215 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: PX.font.display,
                    fontSize: 18,
                    fontWeight: 500,
                    lineHeight: 1.5,
                    letterSpacing: '-0.54px',
                    color: PX.neutral700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Biens transactés
                </p>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: PX.font.display,
                      fontWeight: 500,
                      lineHeight: 1.15,
                      letterSpacing: '-2.16px',
                    }}
                  >
                    <span style={{ color: PX.neutral700, fontSize: 72 }}>10k</span>
                    <span style={{ color: PX.neutral400, fontSize: 72, fontWeight: 400 }}>+</span>
                  </p>
                  <p
                    style={{
                      margin: 0,
                      width: 215,
                      fontFamily: PX.font.sans,
                      fontSize: 16,
                      fontWeight: 400,
                      lineHeight: 1.5,
                      letterSpacing: '-0.48px',
                      color: PX.neutral500,
                    }}
                  >
                    Transactions closées avec nos agents.
                  </p>
                </div>
              </div>

              {/* Stat 2 : Annonces publiées */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 215 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: PX.font.display,
                    fontSize: 18,
                    fontWeight: 500,
                    lineHeight: 1.5,
                    letterSpacing: '-0.54px',
                    color: PX.neutral700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Annonces publiées
                </p>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: PX.font.display,
                      fontWeight: 500,
                      lineHeight: 1.15,
                      letterSpacing: '-2.16px',
                    }}
                  >
                    <span style={{ color: PX.neutral700, fontSize: 72 }}>500</span>
                    <span style={{ color: PX.neutral400, fontSize: 72, fontWeight: 400 }}>k</span>
                  </p>
                  <p
                    style={{
                      margin: 0,
                      width: 215,
                      fontFamily: PX.font.sans,
                      fontSize: 16,
                      fontWeight: 400,
                      lineHeight: 1.5,
                      letterSpacing: '-0.48px',
                      color: PX.neutral500,
                    }}
                  >
                    Mises à jour quotidiennes en Suisse.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grande image à droite (flex-1) */}
          <div
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: 662,
              borderRadius: PX.radius.large,
              overflow: 'hidden',
              backgroundImage:
                'url("https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=85")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </div>
      </div>
    </section>
  )
}

// ─── Section 2 — Value ───────────────────────────────────────────────────────
type ValueCardData = {
  iconName: FilledIconName
  title: string
  description: string
}

const VALUE_CARDS: ValueCardData[] = [
  {
    iconName: 'bulb',
    title: 'Innovation',
    description: 'Outils IA et copilote agent : nous repensons chaque étape du parcours immobilier.',
  },
  {
    iconName: 'star',
    title: 'Excellence',
    description: 'KYC complet, vérification dilisense, audit trail intégral à chaque transaction.',
  },
  {
    iconName: 'chart',
    title: 'Croissance',
    description: 'Pipeline transactionnel pensé pour scaler. Nos agences franchissent leurs paliers.',
  },
  {
    iconName: 'team',
    title: 'Esprit d\'équipe',
    description: 'Agents, agences et clients connectés sur une même plateforme collaborative.',
  },
  {
    iconName: 'chat',
    title: 'Communication',
    description: 'Messagerie unifiée, timeline contact, alertes : chaque interaction tracée.',
  },
  {
    iconName: 'flag',
    title: 'Engagement',
    description: 'Nous mesurons notre succès aux closings de nos clients. Pas aux pages vues.',
  },
]

function ValueCard({ data, alignment = 'end' }: { data: ValueCardData; alignment?: 'end' | 'start' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: 272,
        alignSelf: alignment === 'end' ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FilledIcon name={data.iconName} size={28} color={PX.neutral700} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
          }}
        >
          {data.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
          }}
        >
          {data.description}
        </p>
      </div>
    </div>
  )
}

function ValueSection() {
  return (
    <section style={{ padding: '80px 0', background: PX.neutral100 }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 48,
          padding: '0 40px',
        }}
      >
        {/* Left Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: 500 }}>
          <EyebrowBadge text="Nos valeurs" iconName="star" />
          <div style={{ paddingTop: 16 }}>
            <h2
              style={{
                margin: 0,
                width: 580,
                fontFamily: PX.font.display,
                fontSize: 48,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-1.44px',
                color: PX.neutral700,
              }}
            >
              Les valeurs qui guident nos décisions
            </h2>
          </div>
          <div style={{ paddingTop: 16 }}>
            <p
              style={{
                margin: 0,
                width: 470,
                fontFamily: PX.font.sans,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}
            >
              Compliance-first, agent-centric, transparent : voici les principes qui orientent chaque décision.
            </p>
          </div>
          <div style={{ paddingTop: 24 }}>
            <PxButton to="/acheter" variant="primary" size="lg">
              Commencer
            </PxButton>
          </div>
        </div>

        {/* Grid Wrapper : 3 rows de 2 cards séparées par dividers */}
        <div style={{ width: 592, display: 'flex', flexDirection: 'column', gap: 47 }}>
          {/* Row 1 — items-end */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
            <ValueCard data={VALUE_CARDS[0]} alignment="end" />
            <ValueCard data={VALUE_CARDS[1]} alignment="end" />
          </div>
          <div style={{ height: 1, background: PX.neutral300, width: '100%' }} />

          {/* Row 2 — items-end */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
            <ValueCard data={VALUE_CARDS[2]} alignment="end" />
            <ValueCard data={VALUE_CARDS[3]} alignment="end" />
          </div>
          <div style={{ height: 1, background: PX.neutral300, width: '100%' }} />

          {/* Row 3 — items-start */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
            <ValueCard data={VALUE_CARDS[4]} alignment="start" />
            <ValueCard data={VALUE_CARDS[5]} alignment="start" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 3 — Mission ─────────────────────────────────────────────────────
function MissionSection() {
  return (
    <section
      style={{
        padding: '80px 40px 160px',
        background: PX.neutral100,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 80,
        }}
      >
        {/* Image gauche 612.875×600 */}
        <div
          style={{
            width: 612.875,
            height: 600,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
            backgroundImage:
              'url("https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=85")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            flexShrink: 0,
          }}
        />

        {/* Right Element 507×600, justify-between */}
        <div
          style={{
            width: 507,
            height: 600,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {/* Top : badge + title */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <EyebrowBadge text="Notre mission" iconName="user" />
            <div style={{ paddingTop: 16 }}>
              <h2
                style={{
                  margin: 0,
                  width: 507,
                  fontFamily: PX.font.display,
                  fontSize: 48,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-1.44px',
                  color: PX.neutral700,
                }}
              >
                Un seul objectif&nbsp;: trouver le bien qui vous ressemble
              </h2>
            </div>
          </div>

          {/* Bottom : paragraph + button */}
          <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column' }}>
            <p
              style={{
                margin: 0,
                width: 480,
                fontFamily: PX.font.sans,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}
            >
              Acheter, louer ou vendre en Suisse ne devrait pas ressembler à un parcours du combattant. MEGGA centralise les annonces, vérifie les agents, automatise la conformité et garde un humain au centre de chaque décision. Notre but, c’est que vous puissiez signer en confiance.
            </p>
            <div style={{ paddingTop: 24 }}>
              <PxButton to="/acheter" variant="primary" size="lg">
                Commencer
              </PxButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 4 — Offices (fond noir) ─────────────────────────────────────────
type OfficeData = {
  city: string
  description: string
  email: string
  phone: string
  image: string
}

const OFFICES: OfficeData[] = [
  {
    city: 'Genève',
    description: 'Notre siège historique au cœur de la Rive Gauche, à deux pas de la place du Molard.',
    email: 'geneve@megga.ch',
    phone: '+41 22 555 01 02',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1400&q=85',
  },
  {
    city: 'Zurich',
    description: 'Notre antenne alémanique sur la Bahnhofstrasse, dédiée au marché outre-Sarine.',
    email: 'zurich@megga.ch',
    phone: '+41 44 555 01 02',
    image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1400&q=85',
  },
]

function OfficeCard({ office }: { office: OfficeData }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 588,
        height: 500,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Image fond */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${office.image}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Gradient overlay top → bottom (rgba(0,0,0,0.8) → transparent) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%)',
          pointerEvents: 'none',
        }}
      />
      {/* Contenu top-left */}
      <div
        style={{
          position: 'absolute',
          top: 49,
          left: 41,
          width: 379,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: PX.neutral100,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.9px',
            }}
          >
            {office.city}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
            }}
          >
            {office.description}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PxIcon name="mail" size={20} color={PX.neutral100} strokeWidth={1.8} />
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
            }}
          >
            {office.email}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PxIcon name="phone" size={20} color={PX.neutral100} strokeWidth={1.8} />
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
            }}
          >
            {office.phone}
          </p>
        </div>
      </div>
    </div>
  )
}

function OfficesSection() {
  return (
    <section style={{ padding: '0 24px', background: PX.neutral100 }}>
      <div
        style={{
          maxWidth: 1392,
          margin: '0 auto',
          background: PX.neutral700,
          borderRadius: PX.radius.large,
          padding: '160px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Top Content (1198 wide) */}
        <div
          style={{
            width: 1198,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingBottom: 48,
            gap: 48,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <EyebrowBadge text="Nos bureaux" iconName="star" invert />
            <div style={{ paddingTop: 16 }}>
              <h2
                style={{
                  margin: 0,
                  width: 614,
                  fontFamily: PX.font.display,
                  fontSize: 48,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-1.44px',
                  color: PX.neutral100,
                }}
              >
                Venez visiter nos bureaux
              </h2>
            </div>
            <div style={{ paddingTop: 16 }}>
              <p
                style={{
                  margin: 0,
                  width: 480,
                  fontFamily: PX.font.sans,
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  letterSpacing: '-0.48px',
                  color: PX.neutral400,
                }}
              >
                Deux adresses, deux régions linguistiques, une seule équipe. Prenez rendez-vous, nous serons heureux de vous accueillir.
              </p>
            </div>
          </div>
          <div style={{ paddingTop: 48 }}>
            <PxButton to="/contact" variant="invert" size="lg">
              Nous contacter
            </PxButton>
          </div>
        </div>

        {/* Cards Wrapper (2 cards 588 wide, gap 24) */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {OFFICES.map(office => (
            <OfficeCard key={office.city} office={office} />
          ))}
        </div>

        {/* Bottom Button Row */}
        <div style={{ paddingTop: 48 }}>
          <PxButton to="/contact" variant="invert" size="lg">
            Nous contacter
          </PxButton>
        </div>
      </div>
    </section>
  )
}

// ─── Section 5 — Team ────────────────────────────────────────────────────────
type AgentData = {
  name: string
  role: string
  image: string
}

const AGENTS: AgentData[] = [
  {
    name: 'Gregory Lyonnet',
    role: 'Agent fondateur',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=85',
  },
  {
    name: 'Sophie Moreau',
    role: 'Agente certifiée',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=85',
  },
  {
    name: 'Mathieu Bertrand',
    role: 'Agent certifié',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=85',
  },
]

function ProfileCard({ agent }: { agent: AgentData }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 350,
        height: 380,
        borderRadius: PX.radius.large,
        background: PX.neutral100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Bouton plus en haut à droite */}
      <button
        type="button"
        aria-label={`Voir ${agent.name}`}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          width: 40,
          height: 40,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          border: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PxIcon name="plus" size={16} color={PX.neutral100} strokeWidth={2.5} />
      </button>

      {/* Avatar + Info */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: PX.radius.pill,
            background: PX.neutral300,
            overflow: 'hidden',
            backgroundImage: `url("${agent.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.72px',
              color: PX.neutral700,
              textAlign: 'center',
            }}
          >
            {agent.name}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              textAlign: 'center',
            }}
          >
            {agent.role}
          </p>
        </div>
      </div>

      {/* Social icons (2 ronds 40px bg neutral200) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: PX.radius.pill,
            background: PX.neutral200,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PxIcon name="mail" size={20} color={PX.neutral700} strokeWidth={1.8} />
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: PX.radius.pill,
            background: PX.neutral200,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PxIcon name="phone" size={20} color={PX.neutral700} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  )
}

function TeamSection() {
  return (
    <section
      style={{
        padding: '160px 40px',
        background: PX.neutral100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Top Content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <EyebrowBadge text="Nos agents" iconName="home" />
          <div style={{ paddingTop: 16 }}>
            <h2
              style={{
                margin: 0,
                width: 600.5,
                fontFamily: PX.font.display,
                fontSize: 48,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-1.44px',
                color: PX.neutral700,
                textAlign: 'center',
              }}
            >
              Rencontrez nos agents
            </h2>
          </div>
        </div>
        <div style={{ paddingTop: 16, paddingBottom: 32 }}>
          <p
            style={{
              margin: 0,
              width: 562,
              fontFamily: PX.font.sans,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              textAlign: 'center',
            }}
          >
            Tous nos agents passent par une vérification KYC complète et un parcours de formation continue. Vous savez toujours à qui vous parlez et pourquoi vous lui faites confiance.
          </p>
        </div>
      </div>

      {/* Grid Cards (3 cards × 350, gap 24) */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {AGENTS.map(agent => (
          <ProfileCard key={agent.name} agent={agent} />
        ))}
      </div>

      {/* Buttons Row */}
      <div style={{ paddingTop: 48, display: 'flex', alignItems: 'center', gap: 16 }}>
        <PxButton to="/agents" variant="primary" size="lg">
          Commencer
        </PxButton>
        <PxTextLink to="/agents">Voir tous les agents</PxTextLink>
      </div>
    </section>
  )
}

// ─── Section 6 — Follow Us (Instagram, full bleed 1888) ──────────────────────
type IgCardData = {
  username: string
  handle: string
  image: string
  likes: string
  comments: string
}

const IG_POSTS: IgCardData[] = [
  {
    username: 'MEGGA Suisse',
    handle: '@megga.ch',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=85',
    likes: '126k likes',
    comments: 'Voir les 2,4k commentaires',
  },
  {
    username: 'MEGGA Suisse',
    handle: '@megga.ch',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=85',
    likes: '98k likes',
    comments: 'Voir les 1,8k commentaires',
  },
  {
    username: 'MEGGA Suisse',
    handle: '@megga.ch',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=85',
    likes: '142k likes',
    comments: 'Voir les 3,1k commentaires',
  },
  {
    username: 'MEGGA Suisse',
    handle: '@megga.ch',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=900&q=85',
    likes: '87k likes',
    comments: 'Voir les 1,2k commentaires',
  },
]

function IgCard({ post }: { post: IgCardData }) {
  return (
    <div
      style={{
        width: 454,
        height: 634,
        borderRadius: PX.radius.large,
        background: PX.neutral100,
        boxShadow: PX.shadow.small,
        position: 'relative',
        flexShrink: 0,
        padding: '25.41px 28.04px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Heading : avatar + username/handle + bouton ... */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Avatar */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              background: PX.neutral700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: PX.neutral100,
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            M
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p
              style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 18,
                fontWeight: 500,
                lineHeight: 1.5,
                letterSpacing: '-0.54px',
                color: PX.neutral700,
              }}
            >
              {post.username}
            </p>
            <p
              style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
              }}
            >
              {post.handle}
            </p>
          </div>
        </div>
        {/* Menu ... */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            paddingTop: 4,
            paddingRight: 4,
          }}
        >
          <span style={{ width: 4, height: 4, borderRadius: 99, background: PX.neutral500 }} />
          <span style={{ width: 4, height: 4, borderRadius: 99, background: PX.neutral500 }} />
          <span style={{ width: 4, height: 4, borderRadius: 99, background: PX.neutral500 }} />
        </div>
      </div>

      {/* Image principale (454×399 - les bords sont à -28 du padding card) */}
      <div
        style={{
          marginLeft: -28.04,
          marginRight: -28.04,
          marginTop: 24,
          height: 399,
          width: 454,
          backgroundImage: `url("${post.image}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Bottom : icons à gauche, bookmark à droite */}
      <div
        style={{
          marginTop: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PxIcon name="heart" size={26} color={PX.neutral700} strokeWidth={1.8} />
          <PxIcon name="message" size={26} color={PX.neutral700} strokeWidth={1.8} />
          <PxIcon name="send" size={26} color={PX.neutral700} strokeWidth={1.8} />
        </div>
        <PxIcon name="bookmark" size={24} color={PX.neutral700} strokeWidth={1.8} />
      </div>

      {/* Likes + comments */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p
          style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
          }}
        >
          {post.likes}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.42px',
            color: PX.neutral700,
          }}
        >
          {post.comments}
        </p>
      </div>
    </div>
  )
}

function FollowSection() {
  return (
    <section
      style={{
        padding: '80px 0 160px',
        background: PX.neutral100,
        overflowX: 'hidden',
      }}
    >
      {/* Top Content centré à 1200 */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 40px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 48,
          paddingBottom: 48,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <EyebrowBadge text="Suivez-nous" iconName="home" />
          <div style={{ paddingTop: 16 }}>
            <h2
              style={{
                margin: 0,
                width: 414,
                fontFamily: PX.font.display,
                fontSize: 48,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-1.44px',
                color: PX.neutral700,
              }}
            >
              Suivez notre actualité sur Instagram
            </h2>
          </div>
        </div>
        <div style={{ paddingTop: 16, paddingBottom: 16 }}>
          <p
            style={{
              margin: 0,
              width: 437,
              fontFamily: PX.font.sans,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
            }}
          >
            Coups de cœur, projets en cours, coulisses des transactions : nous partageons l’envers du décor de l’immobilier suisse, un post à la fois.
          </p>
        </div>
      </div>

      {/* Row Cards (4 cards × 454 = 1816 + 3×24 = 1888 — full bleed centré) */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          paddingLeft: 'max(40px, calc((100vw - 1888px) / 2))',
          paddingRight: 'max(40px, calc((100vw - 1888px) / 2))',
          scrollbarWidth: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {IG_POSTS.map((post, i) => (
            <IgCard key={i} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Page principale ────────────────────────────────────────────────────────
export default function PropertyXAboutPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: PX.pageBg,
        fontFamily: PX.font.sans,
        color: PX.ink,
      }}
    >
      <PxNav glass />
      <HeroSection />
      <ValueSection />
      <MissionSection />
      <OfficesSection />
      <TeamSection />
      <FollowSection />
      <PxFooter />
    </div>
  )
}
