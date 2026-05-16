// MEGGA Pro — FAQ B2B (objections handling).
// Pattern inspiré de PxFAQ : card centrée, accordion items.

import { useState } from 'react'
import { PX, PxSectionLabel, PxIcon } from '../..'
import { useProFadeIn } from './useProFadeIn'

interface Question {
  id: string
  q: string
  a: string
}

const QUESTIONS: Question[] = [
  {
    id: 'trial',
    q: 'Y a-t-il un essai gratuit ?',
    a: "Oui. Le plan Starter est gratuit à vie : jusqu'à 50 contacts, 5 biens, 20 requêtes IA par mois et 5 vérifications KYC. Aucune carte bancaire requise. Quand vous voulez plus, vous passez en Pro en 1 clic.",
  },
  {
    id: 'migration',
    q: "Comment migrer depuis mon CRM actuel ?",
    a: "MEGGA importe nativement CSV, vCard, Apimo, Sweepbright et Excel. Pour les migrations complexes (>1000 contacts ou structures custom), notre équipe assure la reprise gratuitement : data review, mapping, import, contrôle qualité. Comptez 24-48h en moyenne.",
  },
  {
    id: 'data',
    q: 'Où sont stockées les données ?',
    a: "Tout sur Supabase Pro, région eu-west-1 (Irlande). Conforme LPD suisse et RGPD. Chiffrement at-rest et in-transit. RLS activé sur chaque table : votre agence ne voit que ses propres données, jamais celles d'une autre.",
  },
  {
    id: 'kyc',
    q: "Le screening LAB/KYC est-il vraiment conforme FINMA ?",
    a: "Le screening utilise dilisense (base PEP/sanctions internationale, mise à jour quotidienne). Mais MEGGA ne remplace pas votre jugement professionnel : chaque match doit être validé manuellement. Nous fournissons l'outil, vous gardez la responsabilité — comme l'exige la LBA.",
  },
  {
    id: 'support',
    q: 'Le support est-il en français ?',
    a: "Oui, support en français, allemand, italien et anglais. Plan Pro : réponse sous 12h ouvrées. Plan Entreprise : Slack dédié + onboarding personnalisé + chargé de compte attitré. Tous les plans : centre d'aide complet et bibliothèque de templates.",
  },
  {
    id: 'team',
    q: 'Combien de membres dans mon équipe ?',
    a: "Starter : 1 utilisateur. Pro : jusqu'à 5. Entreprise : illimité. Les permissions sont fines : agents voient leurs propres deals, le manager voit toute l'agence, le super-admin voit les analytics. Chaque action est tracée dans l'audit trail.",
  },
]

function AccordionItem({
  question,
  open,
  onToggle,
}: {
  question: Question
  open: boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      borderBottom: `1px solid ${PX.neutral300}`,
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '24px 0',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <span style={{
          flex: 1,
          fontFamily: PX.font.display,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '-0.6px',
          lineHeight: 1.3,
          color: PX.neutral700,
        }}>
          {question.q}
        </span>
        <span style={{
          width: 36,
          height: 36,
          borderRadius: PX.radius.pill,
          background: open ? PX.neutral700 : PX.neutral200,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          transition: `background ${PX.duration.base} ${PX.ease}, transform ${PX.duration.base} ${PX.ease}`,
          transform: open ? 'rotate(45deg)' : 'rotate(0)',
        }}>
          <PxIcon name="plus" size={14} color={open ? PX.neutral100 : PX.neutral700} />
        </span>
      </button>
      <div style={{
        overflow: 'hidden',
        maxHeight: open ? 240 : 0,
        opacity: open ? 1 : 0,
        transition: `max-height ${PX.duration.base} ${PX.ease}, opacity ${PX.duration.base} ${PX.ease}`,
      }}>
        <p style={{
          margin: 0,
          paddingBottom: 24,
          paddingRight: 60,
          fontFamily: PX.font.sans,
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.6,
          letterSpacing: '-0.45px',
          color: PX.neutral500,
        }}>
          {question.a}
        </p>
      </div>
    </div>
  )
}

export default function PxProFAQ() {
  const [openId, setOpenId] = useState<string | null>('trial')
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const cardRef = useProFadeIn<HTMLDivElement>(200)

  return (
    <section style={{
      paddingTop: 120,
      paddingBottom: 120,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.pageBg,
    }}>
      <div style={{
        maxWidth: 880,
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          marginBottom: 56,
          textAlign: 'center',
        }}>
          <div ref={labelRef}>
            <PxSectionLabel icon="help">Questions fréquentes</PxSectionLabel>
          </div>
          <h2
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 56,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-2.5px',
              color: PX.neutral700,
              maxWidth: 720,
            }}
          >
            On vous a entendu.
          </h2>
        </div>

        {/* Accordion card */}
        <div
          ref={cardRef}
          style={{
            background: PX.neutral100,
            border: `1px solid ${PX.neutral300}`,
            borderRadius: PX.radius.large,
            padding: '12px 40px',
            boxShadow: PX.shadow.small,
          }}
        >
          {QUESTIONS.map(q => (
            <AccordionItem
              key={q.id}
              question={q}
              open={openId === q.id}
              onToggle={() => setOpenId(openId === q.id ? null : q.id)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
