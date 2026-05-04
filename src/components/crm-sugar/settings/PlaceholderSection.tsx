// MEGGA CRM Sugar v2 — Settings placeholder section (used for non-built sections)
// 1:1 port from `crm-screen-settings-sugar.jsx` (PlaceholderSection).

import { SetIcon } from './atoms'
import { SET_PALETTE, type SettingsSection } from './data'

const SET = SET_PALETTE

export function PlaceholderSection({ section }: { section: SettingsSection }) {
  return (
    <div
      style={{
        animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        paddingBottom: 40,
      }}
    >
      <div style={{ marginBottom: 24, maxWidth: 720 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          {section.label}
        </div>
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: 32,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.6,
            lineHeight: 1.1,
          }}
        >
          {section.label} — bientôt
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            color: SET.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Cette section sera détaillée dans une prochaine étape de la maquette.
        </p>
      </div>

      <div
        style={{
          background: SET.card,
          borderRadius: 24,
          padding: '40px 36px',
          boxShadow: SET.shadow,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: SET.cardSubtle,
            color: SET.black,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SetIcon name={section.icon} size={28} stroke={SET.ink} />
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: 17,
              fontWeight: 700,
              color: SET.ink,
              letterSpacing: -0.3,
            }}
          >
            À construire à l'étape suivante
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            La grammaire Sugar et les patterns d'interaction sont déjà définis.
            Cette section reprendra cards blanches, sticky save, modals de confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}
