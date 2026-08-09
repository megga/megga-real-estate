// MEGGA CRM — Contacts · État « Compte neuf » (premier lancement).
// Port du handoff Beta v1 (`crm-contacts-firstrun.jsx`) : couverture pleine page
// « Vos contacts, prêts à matcher » + 2 étapes (WhatsApp / matching) sur fond nu.
//
// EXCEPTION TOKENS ASSUMÉE — comme BiensFirstRun.tsx et la couverture Pipeline,
// cette couverture est MONO-THÈME : fond sombre #0A0B0D et textes blancs en dur,
// quel que soit le thème de l'app. Ne PAS « corriger » ces couleurs vers les
// tokens bg-theme-* / sp.* : la maquette repose dessus. Seule la modale WhatsApp,
// qui reste thémée, consomme `sp` et `dark`.
//
// COUVERTURE (D9) : illustration vectorielle plein cadre, servie depuis
// `public/contacts/contacts-cover.svg` (~2,3 Mo brut, ~420 Ko sur le réseau une
// fois compressée). Elle est purement décorative (aria-hidden) et le fond
// #0A0B0D reste sous elle : si le fichier manque ou tarde, l'écran est lisible
// sans lui. Repasser COVER_SRC à `null` suffit à la retirer.
//
// La modale WhatsApp est gérée en interne (état `waOpen`) → l'API se limite à
// { sp, dark, onManual }. `onManual` est appelé APRÈS le skeleton (le parent
// ouvre alors la modale Nouveau contact qui recouvre le skeleton) : le premier
// lancement conserve volontairement un accès discret à la création manuelle,
// sans quoi un compte neuf sans WhatsApp serait dans un cul-de-sac.

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { NcvIcon } from '@/components/crm-sugar/contacts-pager/ncvIcon'
import WhatsAppConnectModal from '@/components/crm-sugar/contacts-pager/WhatsAppConnectModal'

/** Illustration plein cadre de la couverture. `null` ⇒ fond plat #0A0B0D. */
const COVER_SRC: string | null = '/contacts/contacts-cover.svg'

/** Marque WhatsApp officielle en couleur (pastille verte) — étape 1 seulement. */
const WA_BRAND_SRC = '/contacts/whatsapp.svg'

// ── Étape de la couverture : pastille + titre + sous-titre + pilule ──────
// Rendue en <button> quand elle est actionnable (étape 1 → modale WhatsApp),
// en <div> inerte sinon (étape 2 : la pilule « Automatique » constate le
// comportement du matching, elle n'ouvre aucun réglage).
function CfrStep({
  iconNode, title, sub, ctaLabel, onClick,
}: {
  iconNode: ReactNode
  title: string
  sub: string
  ctaLabel: string
  onClick?: () => void
}) {
  const body = (
    <>
      <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {iconNode}
      </span>
      <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 700, letterSpacing: -0.3, color: '#FFFFFF', lineHeight: 1.25, marginTop: 16 }}>{title}</span>
      <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginTop: 6, textWrap: 'pretty' }}>{sub}</span>
      <span style={{
        marginTop: 18, height: 34, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', display: 'inline-flex', alignItems: 'center',
        background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', fontSize: 'var(--crm-text-md)', fontWeight: 700,
      }}>
        {ctaLabel}
      </span>
    </>
  )
  const shell: React.CSSProperties = {
    background: 'transparent', border: 0, borderRadius: 'var(--crm-radius-3xl)', padding: '30px 24px 26px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    fontFamily: 'inherit',
  }
  return onClick
    ? <button type="button" onClick={onClick} style={{ ...shell, cursor: 'pointer' }}>{body}</button>
    : <div style={{ ...shell, cursor: 'default' }}>{body}</div>
}

// ── Skeleton « création de la fiche » — mime la mise en page de NewContactModal
//    pour enchaîner sans rupture sur le vrai formulaire. ─────────────────
function CfrBuildSkeleton({ sp, dark }: { sp: SugarPalette; dark: boolean }) {
  const skVars = {
    '--sk': dark ? 'rgba(255,255,255,.08)' : '#E7EAF0',
    '--skHi': dark ? 'rgba(255,255,255,.17)' : '#F5F7FA',
  } as React.CSSProperties
  return (
    <div
      aria-hidden="true"
      className="cfr-build"
      style={{
        position: 'absolute', inset: 0, zIndex: 50, background: sp.pageBg,
        display: 'flex', flexDirection: 'column', cursor: 'default', ...skVars,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '18px 26px' }}>
        <div className="cfr-sk" style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)' }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '2px 26px 18px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-6xl)' }}>
          <div className="cfr-build-card" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--crm-space-sm)', animationDelay: '40ms' }}>
            <div className="cfr-sk" style={{ width: 360, height: 30, borderRadius: 'var(--crm-radius-md)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--crm-space-xl)' }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="cfr-build-card"
                style={{
                  background: sp.solidBg, borderRadius: 'var(--crm-radius-3xl)', boxShadow: sp.shadow, minHeight: 118,
                  padding: 'var(--crm-space-4xl) var(--crm-space-3xl)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  animationDelay: `${140 + i * 65}ms`,
                }}
              >
                <div className="cfr-sk" style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-sm)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                  <div className="cfr-sk" style={{ width: '68%', height: 11, borderRadius: 'var(--crm-radius-xs)' }} />
                  <div className="cfr-sk" style={{ width: '44%', height: 9, borderRadius: 'var(--crm-radius-xs)' }} />
                </div>
              </div>
            ))}
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="cfr-build-card"
              style={{
                background: sp.solidBg, borderRadius: 'var(--crm-radius-5xl)', boxShadow: sp.shadow, padding: 'var(--crm-space-6xl) var(--crm-space-7xl)',
                display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', animationDelay: `${420 + i * 110}ms`,
              }}
            >
              <div className="cfr-sk" style={{ width: 120, height: 12, borderRadius: 'var(--crm-radius-xs)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)' }}>
                <div className="cfr-sk" style={{ height: 44, borderRadius: 'var(--crm-radius-lg)' }} />
                <div className="cfr-sk" style={{ height: 44, borderRadius: 'var(--crm-radius-lg)' }} />
              </div>
              <div className="cfr-sk" style={{ height: 44, borderRadius: 'var(--crm-radius-lg)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Couverture premier lancement (page 0 quand l'agence n'a encore aucun contact). */
export default function ContactsFirstRun({
  sp,
  dark,
  onManual,
}: {
  sp: SugarPalette
  dark: boolean
  onManual: () => void
}): JSX.Element {
  const { t } = useTranslation('contacts')
  // Anneau de focus figé clair : la couverture est mono-thème sombre (#0A0B0D), donc
  // la variante « thème clair » #0041D9 y serait un bleu foncé sur presque-noir.
  // `dark` reste utilisé par la modale WhatsApp, qui a son propre traitement.
  const ring = '#8DA4FF'
  const [waOpen, setWaOpen] = useState(false)
  const [building, setBuilding] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const openNew = () => {
    if (building) return
    setBuilding(true)
    timers.current.push(setTimeout(() => onManual(), 900))
    timers.current.push(setTimeout(() => setBuilding(false), 1300))
  }

  return (
    <div
      className="cfr-root"
      style={{
        position: 'absolute', inset: 0, background: '#0A0B0D', overflowY: 'auto', overflowX: 'hidden',
        fontFamily: "'Inter Tight', system-ui, sans-serif", color: '#FFFFFF', fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`
        @keyframes cfrFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cfrOv { from { opacity: 0; } to { opacity: 1; } }
        .cfr-root button:focus-visible { outline: 2.5px solid ${ring}; outline-offset: 3px; }
        .cfr-root :focus:not(:focus-visible) { outline: none; }
        .cfr-manual:hover { text-decoration: underline; }
        @keyframes cfrShimmer { 0% { background-position: -40% 0; } 100% { background-position: 160% 0; } }
        .cfr-build { animation: cfrOv .26s ease both; }
        .cfr-build-card { animation: cfrFadeUp .5s cubic-bezier(.2,.8,.2,1) both; }
        .cfr-sk { background-color: var(--sk); background-image: linear-gradient(90deg, transparent, var(--skHi), transparent);
          background-size: 220% 100%; background-repeat: no-repeat; animation: cfrShimmer 1.25s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cfr-sk { animation: none; } .cfr-build-card { animation: none; } }
        @media (max-width: 820px) { .cfr-steps { grid-template-columns: 1fr !important; } }
      `}</style>

      {COVER_SRC && (
        <img
          src={COVER_SRC}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', top: 0, bottom: 0, left: -3, width: 'calc(100% + 6px)', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none' }}
        />
      )}

      <div style={{
        position: 'relative', zIndex: 2, minHeight: '100%', boxSizing: 'border-box', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 40px',
      }}>
        <div style={{
          maxWidth: 920, width: '100%', textAlign: 'center',
          animation: 'cfrFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-8xl)', fontWeight: 700, letterSpacing: -1, lineHeight: 1.1, color: '#FFFFFF', textShadow: '0 0 24px rgba(255,255,255,0.5)' }}>
            {t('firstRun.title')}
          </h1>
          {/* Coupure de ligne volontaire (handoff) : deux clés plutôt qu'une balise en JSON. */}
          <p style={{ margin: '12px auto 0', maxWidth: 560, fontSize: 'var(--crm-text-xl)', lineHeight: 1.55, fontWeight: 500, color: 'rgba(255,255,255,0.78)', textWrap: 'pretty' }}>
            {t('firstRun.subtitleLine1')}<br />{t('firstRun.subtitleLine2')}
          </p>
        </div>

        <div className="cfr-steps" style={{ display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'center', gap: 'var(--crm-space-4xl)', width: '100%', marginTop: 40 }}>
          <CfrStep
            iconNode={<img src={WA_BRAND_SRC} alt="" aria-hidden="true" width="42" height="42" style={{ width: 42, height: 42, display: 'block' }} />}
            title={t('firstRun.step1Title')}
            sub={t('firstRun.step1Sub')}
            ctaLabel={t('firstRun.step1Cta')}
            onClick={() => setWaOpen(true)}
          />
          <CfrStep
            iconNode={<NcvIcon name="sparkle" size={34} stroke="#FFFFFF" />}
            title={t('firstRun.step2Title')}
            sub={t('firstRun.step2Sub')}
            ctaLabel={t('firstRun.step2Cta')}
          />
        </div>

        {/* Sortie de secours : sans elle, un compte neuf sans WhatsApp ne peut rien créer. */}
        <button
          type="button"
          className="cfr-manual"
          onClick={openNew}
          style={{
            marginTop: 10, background: 'transparent', border: 0, padding: 'var(--crm-space-sm) var(--crm-space-md)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: 'rgba(255,255,255,0.6)',
          }}
        >
          {t('firstRun.manualLink')}
        </button>
      </div>

      {building && <CfrBuildSkeleton sp={sp} dark={dark} />}

      <WhatsAppConnectModal open={waOpen} onClose={() => setWaOpen(false)} sp={sp} dark={dark} />
    </div>
  )
}
