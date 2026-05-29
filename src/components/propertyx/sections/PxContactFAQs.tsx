// MEGGA Marketplace — Property X "Contact V1 — FAQs" section.
// Source visuelle : Figma node 11774:16850.
//
// Anatomie :
// - Section py-80 centered
// - Top Content : Badge + H2 + paragraph
// - Accordion 843 wide : bg-neutral100 rounded-20 shadow-small
//   - 4 items pliables (par défaut le premier ouvert)
//   - Item collapsed : title 24 + plus icon (18.385 size)
//   - Item expanded : title + answer 16/1.5 + minus button (40×40 dark)
//   - Spacing inter-items : padding 30/30 avec divider 1px neutral300
//
// Différences avec le Figma de base :
//   - Contenu FR (vraies FAQs MEGGA : estimation, mandat, marketplace, KYC)
//   - Items configurables via props
//   - Accordéon : `defaultOpen` configurable, click pour ouvrir/fermer
//   - JSON-LD FAQ rendu par la page parente, pas ici (séparation des concerns)

import { Fragment, useState } from 'react'
import { PX, PxFigmaIcon } from '..'

export interface FAQItem {
  question: string
  answer: string
}

interface PxContactFAQsProps {
  badge?: string
  title?: string
  description?: string
  faqs?: FAQItem[]
  /** Index de l'item ouvert par défaut. -1 pour tout fermer. */
  defaultOpenIndex?: number
}

const DEFAULT_FAQS: FAQItem[] = [
  {
    question: 'Sous combien de temps recevrai-je une réponse ?',
    answer:
      'Un membre de l’équipe MEGGA répond personnellement à chaque message sous 24 heures ouvrées. Les demandes urgentes (visite déjà programmée, dossier en cours) sont traitées en priorité.',
  },
  {
    question: 'Puis-je faire estimer mon bien gratuitement ?',
    answer:
      'Oui. L’estimation MEGGA combine une analyse algorithmique (~30 secondes) et la validation d’un agent local sur place, sans aucun engagement. Vous recevez un rapport PDF en moins de 48 heures.',
  },
  {
    question: 'Quels sont vos frais de mandat ?',
    answer:
      'Nos honoraires de mandat exclusif s’élèvent à 3 % HT du prix de vente, intégralement à la charge du vendeur et uniquement dus en cas de transaction signée chez le notaire. Aucun frais caché, aucun frais de retrait.',
  },
  {
    question: 'Comment publier mon bien sur la marketplace MEGGA ?',
    answer:
      'Les particuliers passent par notre page « Publier un bien » : photos, description, prix et coordonnées. La diffusion sur megga.ch est gratuite. Les agences professionnelles bénéficient d’une intégration automatisée via notre CRM.',
  },
]

function FaqsBadge({ label }: { label: string }) {
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
        <PxFigmaIcon name="badge-faq" size={14.857} color={PX.neutral100} />
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

function AccordionItem({ item, isOpen, onToggle }: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      paddingLeft: 40,
      paddingRight: 40,
      position: 'relative',
    }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 22,
          lineHeight: 1.3,
          letterSpacing: '-0.66px',
          color: PX.neutral700,
          paddingRight: 60,
        }}>
          {item.question}
        </h3>
        {isOpen && (
          <div style={{ paddingTop: 16 }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.55,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              maxWidth: 600,
            }}>
              {item.answer}
            </p>
          </div>
        )}
      </button>

      <div style={{
        position: 'absolute',
        top: isOpen ? -2 : 4,
        right: 40,
        pointerEvents: 'none',
      }}>
        {isOpen ? (
          <span style={{
            width: 36,
            height: 36,
            borderRadius: PX.radius.pill,
            background: PX.neutral700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10" stroke={PX.neutral100} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <span style={{
            display: 'inline-flex',
            color: PX.neutral700,
          }}>
            <PxFigmaIcon name="plus" size={18.385} color={PX.neutral700} />
          </span>
        )}
      </div>
    </div>
  )
}

export default function PxContactFAQs(props: PxContactFAQsProps = {}) {
  const {
    badge = 'Questions fréquentes',
    title = 'Vos questions, nos réponses',
    description =
      'Les réponses aux questions qui reviennent le plus souvent. Si la vôtre n’y est pas, écrivez-nous — nous répondons sous 24 heures ouvrées.',
    faqs = DEFAULT_FAQS,
    defaultOpenIndex = 0,
  } = props

  const [openIdx, setOpenIdx] = useState<number>(defaultOpenIndex)

  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 80,
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: PX.pageBg,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <FaqsBadge label={badge} />
        <div style={{ paddingTop: 16 }}>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 48,
            lineHeight: 1.1,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
            textAlign: 'center',
            maxWidth: 686,
          }}>
            {title}
          </h2>
        </div>
        <div style={{ paddingTop: 16, paddingBottom: 32 }}>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
            textAlign: 'center',
            maxWidth: 562,
          }}>
            {description}
          </p>
        </div>
      </div>

      <div style={{
        background: PX.neutral100,
        width: 843,
        maxWidth: '100%',
        borderRadius: 20,
        boxShadow: PX.shadow.small,
        paddingTop: 44,
        paddingBottom: 38,
        boxSizing: 'border-box',
      }}>
        {faqs.map((item, idx) => (
          <Fragment key={item.question}>
            <AccordionItem
              item={item}
              isOpen={openIdx === idx}
              onToggle={() => setOpenIdx(openIdx === idx ? -1 : idx)}
            />
            {idx < faqs.length - 1 && (
              <div style={{ paddingTop: 30, paddingBottom: 30 }}>
                <hr style={{
                  height: 1,
                  width: '100%',
                  background: PX.neutral300,
                  border: 0,
                  margin: 0,
                }} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  )
}
