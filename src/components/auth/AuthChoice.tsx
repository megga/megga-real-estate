// MEGGA — Auth choice screen (port 1:1 du proto megga-auth-modal.jsx).
// 2 cartes : Particulier (blanc) + Agent (sombre, accent vert MEGGA).

import { AUTH_FONT, AUTH_M } from './authTokens'

interface AuthChoiceProps {
  onChoose: (view: 'particulier' | 'agent') => void
}

const CARDS = [
  {
    view: 'particulier' as const,
    title: 'Trouver, vendre, gérer',
    body:
      "Publiez votre annonce, suivez vos favoris, recevez des alertes prix et estimez votre bien gratuitement.",
    bullets: [
      "Publication d'annonce illimitée",
      'Estimation IA + expert',
      'Alertes prix et baisses',
      'Coffre-fort de visites',
    ],
    bg: '#fff',
    ink: AUTH_M.ink,
    accent: AUTH_M.green,
    cta: 'Continuer en particulier',
  },
  {
    view: 'agent' as const,
    title: 'CRM immobilier complet',
    body:
      "Pipeline de mandats, équipes, mailing, signature, agenda et rapports. 100% gratuit, sans engagement.",
    bullets: [
      'Pipeline mandats illimité',
      'Mailing & relances auto',
      'Agenda partagé',
      'Signature & DocuSign intégrés',
    ],
    bg: AUTH_M.ink,
    ink: '#fff',
    accent: AUTH_M.green,
    cta: 'Accéder au CRM',
  },
]

export default function AuthChoice({ onChoose }: AuthChoiceProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 880,
        padding: '0 clamp(20px, 4vw, 40px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
      }}
    >
      {CARDS.map(card => (
        <button
          key={card.view}
          onClick={() => onChoose(card.view)}
          style={{
            textAlign: 'left',
            padding: '32px 30px 28px',
            background: card.bg,
            color: card.ink,
            border: card.bg === '#fff' ? `1px solid ${AUTH_M.border}` : 'none',
            borderRadius: 18,
            cursor: 'pointer',
            fontFamily: AUTH_FONT,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 380,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-3px)'
            e.currentTarget.style.boxShadow = '0 18px 40px rgba(14,20,16,0.12)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -0.6,
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color:
                card.bg === '#fff' ? AUTH_M.soft : 'rgba(255,255,255,0.75)',
              flex: 1,
            }}
          >
            {card.body}
          </div>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {card.bullets.map(b => (
              <li
                key={b}
                style={{
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color:
                    card.bg === '#fff' ? AUTH_M.ink : 'rgba(255,255,255,0.9)',
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: card.accent,
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
          <div
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 12,
              background: card.bg === '#fff' ? AUTH_M.ink : card.accent,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {card.cta}
            <span>→</span>
          </div>
        </button>
      ))}
    </div>
  )
}
