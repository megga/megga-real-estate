// MEGGA Marketplace — Property X "Contact V1 — Offices" section.
// Source visuelle : Figma node 11770:16459.
//
// Anatomie :
// - Section pt-80 pb-160, container 1198 centered
// - Top Content : Badge "Our offices" + H2 + Paragraph + Primary Button
// - Row Cards (gap 24) :
//   - Image Large (954×440 rounded-24) : photo office + gradient bottom-dark + overlay :
//     - Title white "Ville, Canton" + paragraph + adresse avec icône
//   - Image vertical (221×441 rounded-24) avec opacity 30 (déco)
//
// Différences avec le Figma de base :
//   - Contenu FR et tout configurable via props
//   - Bouton CTA configurable (par défaut "Nous rencontrer")
//   - Image verticale optionnelle (passer `null` pour la cacher)

import { PX, PxFigmaIcon, PxButton } from '..'

export interface PxOfficeCard {
  /** Ex. "Genève, GE". */
  title: string
  /** Sous-titre, 1-2 phrases sur le bureau. */
  description: string
  /** Adresse postale complète. */
  address: string
  /** URL de l'image principale (locale ou CDN). */
  image: string
  /** Lien optionnel cliquable (Google Maps, agenda Calendly…). */
  href?: string
}

interface PxContactOfficesProps {
  /** Texte du badge (par défaut "Nos bureaux"). */
  badge?: string
  /** Titre H2 principal. */
  title?: string
  /** Paragraphe sous le H2. */
  description?: string
  /** Label du bouton CTA. */
  ctaLabel?: string
  /** Lien du bouton CTA. */
  ctaHref?: string
  /** Carte bureau principale (grand format). */
  office?: PxOfficeCard
  /** Image décorative verticale (passer null pour la cacher). */
  verticalImage?: string | null
}

const DEFAULT_OFFICE: PxOfficeCard = {
  title: 'Genève',
  description:
    'Notre bureau historique au cœur des Eaux-Vives. Estimations, mandats et visites sur rendez-vous, du lundi au samedi.',
  address: 'Rue du Rhône — 1204 Genève, Suisse',
  image: '/images/sections/contact/office-sf.jpg',
  href: undefined,
}

function OfficesBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral300,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral400,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="location" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        paddingTop: 2,
      }}>
        {label}
      </span>
    </span>
  )
}

export default function PxContactOffices(props: PxContactOfficesProps = {}) {
  const {
    badge = 'Nos bureaux',
    title = 'Venez nous rencontrer',
    description =
      'Une rencontre vaut mieux qu’un long email. Passez à notre bureau ou organisons une visioconférence — c’est sans engagement.',
    ctaLabel = 'Prendre rendez-vous',
    ctaHref = '#contact',
    office = DEFAULT_OFFICE,
    verticalImage = '/images/sections/contact/office-vertical.jpg',
  } = props

  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 40,
      background: PX.pageBg,
    }}>
      {/* Top Content */}
      <div style={{
        width: 1198,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <OfficesBadge label={badge} />
          <div style={{ paddingTop: 16 }}>
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 48,
              lineHeight: 1.1,
              letterSpacing: '-1.44px',
              color: PX.neutral700,
            }}>
              {title}
            </h2>
          </div>
          <div style={{ paddingTop: 16 }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              maxWidth: 540,
            }}>
              {description}
            </p>
          </div>
        </div>
        <div style={{ paddingTop: 48, flexShrink: 0 }}>
          <a href={ctaHref} style={{ textDecoration: 'none' }}>
            <PxButton variant="primary" size="sm">{ctaLabel}</PxButton>
          </a>
        </div>
      </div>

      {/* Row Cards */}
      <div style={{
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        width: 1198,
        maxWidth: '100%',
      }}>
        {/* Image Large */}
        <div style={{
          position: 'relative',
          flex: verticalImage ? '1 1 954px' : '1 1 100%',
          minWidth: 0,
          height: 440,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
        }}>
          {office.href ? (
            <a href={office.href} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', inset: 0, display: 'block' }}>
              <OfficeContent office={office} />
            </a>
          ) : (
            <OfficeContent office={office} />
          )}
        </div>

        {verticalImage && (
          <div style={{
            position: 'relative',
            width: 221,
            height: 441,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
            flexShrink: 0,
            opacity: 0.3,
          }}>
            <img
              src={verticalImage}
              alt=""
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function OfficeContent({ office }: { office: PxOfficeCard }) {
  return (
    <>
      <img
        src={office.image}
        alt={`Bureau MEGGA ${office.title}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
      }} />
      <div style={{
        position: 'absolute',
        left: 30,
        bottom: 30,
        right: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 469,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1.25,
            letterSpacing: '-0.9px',
            color: PX.neutral100,
          }}>
            {office.title}
          </h3>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
          }}>
            {office.description}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PxFigmaIcon name="location" size={20} color={PX.neutral100} />
          <span style={{
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
            paddingTop: 6,
          }}>
            {office.address}
          </span>
        </div>
      </div>
    </>
  )
}
