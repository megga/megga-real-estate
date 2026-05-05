// MEGGA Homepage — FAQ section (port 1:1 du proto megga-body.jsx).
// Sticky left title + 5-item accordion à droite (numérotés 01-05, +/− animé).

import { useState, useRef, useEffect } from 'react'
import { HOME_FONT, HOME_M } from './homeTokens'

const FAQ_ITEMS = [
  {
    q: 'MEGGA est-il gratuit pour les particuliers ?',
    a: "Oui. Recherche, alertes, favoris, comparaison de biens, estimation IA, planning de visites, signature de mandat — tout est gratuit pour les acheteurs et locataires. Côté vendeur, la publication d'annonce reste également gratuite.",
  },
  {
    q: 'Comment fonctionne l’estimation IA ?',
    a: "L'estimation s'appuie sur les comparables récents (transactions documentées + annonces actives), l'indice cantonal officiel et un facteur d'emplacement. Chaque estimation est sourcée et auditable. Pour aller plus loin, un agent local affine sous 24h.",
  },
  {
    q: 'Vos agents sont-ils certifiés ?',
    a: 'Tous les agents partenaires de MEGGA suivent un parcours de certification LAB/KYC conforme à la directive FINMA. Vous voyez en transparence le statut de certification et les vérifications effectuées sur chaque transaction.',
  },
  {
    q: 'Puis-je signer mon mandat en ligne ?',
    a: 'Oui — signature électronique qualifiée (QES) via Swisscom Sign, conforme à l’art. 412 ss CO et à la SCSE. Validité juridique équivalente à une signature manuscrite, traçabilité auditée.',
  },
  {
    q: 'Comment MEGGA protège-t-il mes données ?',
    a: 'Vos données sont hébergées en Suisse (région eu-west-1) avec chiffrement au repos et en transit. Conforme nLPD + RGPD. Vous pouvez exporter ou supprimer toutes vos données depuis votre espace compte à tout moment.',
  },
]

export default function HomeFAQ() {
  const [open, setOpen] = useState<number>(0)

  return (
    <section
      style={{
        padding: '100px clamp(20px, 5vw, 80px)',
        background: HOME_M.cream,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.4fr)',
          gap: 80,
          alignItems: 'start',
        }}
      >
        <div style={{ position: 'sticky', top: 100 }}>
          <h2
            style={{
              fontFamily: HOME_FONT,
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 700,
              color: HOME_M.ink,
              lineHeight: 1.0,
              margin: 0,
              letterSpacing: -1.6,
            }}
          >
            Questions<br />fréquentes.
          </h2>
        </div>

        <div
          style={{
            background: HOME_M.card,
            border: `1px solid ${HOME_M.border}`,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          {FAQ_ITEMS.map((it, i) => (
            <FAQItem
              key={i}
              index={i}
              q={it.q}
              a={it.a}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
              isLast={i === FAQ_ITEMS.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

interface FAQItemProps {
  q: string
  a: string
  index: number
  isOpen: boolean
  onToggle: () => void
  isLast: boolean
}

function FAQItem({ q, a, index, isOpen, onToggle, isLast }: FAQItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)

  useEffect(() => {
    if (ref.current) setH(ref.current.scrollHeight)
  }, [a])

  return (
    <div
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${HOME_M.border}`,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '26px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: HOME_FONT,
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: HOME_M.muted,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0.5,
              minWidth: 22,
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: HOME_M.ink,
              lineHeight: 1.35,
              letterSpacing: -0.2,
            }}
          >
            {q}
          </span>
        </span>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            flexShrink: 0,
            background: isOpen ? HOME_M.ink : 'transparent',
            border: isOpen ? `1px solid ${HOME_M.ink}` : `1px solid ${HOME_M.border}`,
            color: isOpen ? '#fff' : HOME_M.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s ease',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                width: '100%',
                height: 1.5,
                background: 'currentColor',
                transform: 'translateY(-50%)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                height: '100%',
                width: 1.5,
                background: 'currentColor',
                transform: `translateX(-50%) rotate(${isOpen ? 90 : 0}deg)`,
                transition: 'transform 0.25s ease',
              }}
            />
          </span>
        </span>
      </button>
      <div
        style={{
          height: isOpen ? h : 0,
          opacity: isOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'height 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease',
        }}
      >
        <div ref={ref} style={{ padding: '0 28px 28px 68px' }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: HOME_M.muted,
              maxWidth: 620,
              fontFamily: HOME_FONT,
            }}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}
