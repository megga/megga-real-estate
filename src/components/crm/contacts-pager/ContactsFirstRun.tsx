// MEGGA CRM — Contacts · État « Compte neuf » (premier lancement).
// Port du handoff Beta v1 (`crm-contacts-firstrun.jsx`) : couverture pleine page
// « Vos contacts, prêts à matcher » + trois icônes d'une ligne chacune, sur fond nu.
//
// ⛔ UNE LIGNE PAR ICÔNE, RIEN D'AUTRE (16.09.2026, Julien : « beaucoup trop de
// texte, très très simple »). L'écran portait un sous-titre de deux lignes, puis
// par étape un titre, une phrase et une pilule — neuf blocs de texte pour dire
// « branchez WhatsApp ou créez un contact ». Restent le titre et trois libellés.
//
// ⛔ ELLE SUIT LE THÈME DEPUIS LE 16.09.2026 (Julien : « mise en blanc, synchronisée
// avec le changement de thème — sinon on la supprime »). Elle était MONO-THÈME par
// décision : fond sombre et textes blancs en dur, un bloc noir au milieu d'un CRM
// clair. Sombre, elle rend comme avant ; claire, fond de carte et encres de `sp`.
// ⚠ `BiensFirstRun` et la couverture Pipeline restent, elles, mono-thème.
//
// COUVERTURE (D9) : deux vagues de points, purement décoratives (aria-hidden) —
// la violette collée au coin HAUT-GAUCHE du pager, la magenta au coin BAS-DROIT.
// ⚠ DEUX FICHIERS DE MÊME FORMAT, et c'est ce qui les rend égales. Elles vivaient
// dans UN SVG plein cadre (`contacts-cover.svg`, ~2,3 Mo) rendu en `object-fit:
// cover` : ses marges internes les tenaient à ~40 px du haut et ~20 px du bas, et
// le recadrage de `cover` les déplaçait selon la largeur du pager. Découpé le
// 16.09.2026 en `contacts-cover-haut.svg` et `contacts-cover-bas.svg`, chacun
// recadré au ras de sa vague sur la même boîte (349 × 319,2) : posées au même
// `width`, elles ont la même taille au pixel près et touchent leur bord (mesuré :
// première ligne peinte = 0 en haut, dernière ligne = dernière en bas). Poids
// total inchangé, les définitions de l'autre vague retirées de chaque fichier.
// ⚠ FOND TRANSPARENT : le SVG portait deux rectangles plein cadre (blanc puis
// noir) ; retirés, c'est le fond du conteneur qui suit le thème. Si les fichiers
// manquent ou tardent, l'écran reste lisible sans eux. Repasser COVER à `null`
// suffit à les retirer.
//
// La modale WhatsApp est gérée en interne (état `waOpen`) → l'API se limite à
// { sp, dark, onManual }. `onManual` est appelé APRÈS le skeleton (le parent
// ouvre alors la modale Nouveau contact qui recouvre le skeleton) : le premier
// lancement conserve volontairement un accès discret à la création manuelle,
// sans quoi un compte neuf sans WhatsApp serait dans un cul-de-sac.

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import MEIcon from '@/components/propertyx/MEIcon'
import WhatsAppConnectModal from '@/components/crm/contacts-pager/WhatsAppConnectModal'
import { encreSur, MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { MEGGA_AI_VIOLET } from '@/components/crm/contacts-pager/ctpTokens'
import { useWhatsAppPairing } from '@/hooks/useWhatsAppPairing'

/** Les deux vagues de la couverture, fond transparent. `null` ⇒ fond plat du thème. */
const COVER: { haut: string; bas: string } | null = {
  haut: '/contacts/contacts-cover-haut.svg',
  bas: '/contacts/contacts-cover-bas.svg',
}

/**
 * Largeur d'une vague — la MÊME pour les deux. 41,5 % du pager reproduit la taille
 * qu'elles avaient en `cover` sur un écran 16:10 ; bornée par la HAUTEUR (57 %) pour
 * qu'un pager très large ne les fasse pas monter jusqu'au texte. Unités de conteneur :
 * `.cfr-root` est `container-type: size`.
 */
const VAGUE_LARGEUR = 'min(41.5cqw, 57cqh)'

/**
 * Les couleurs des vagues — des DÉGRADÉS, plus des aplats (16.09.2026, Julien : « un
 * peu plat »). Les fichiers SVG ne servent plus que de MASQUE : leurs points
 * découpent un dégradé CSS, si bien que les couleurs se règlent ici sans retoucher
 * 2,4 Mo de vectoriel, et peuvent bouger.
 *
 * Chaque vague part de son COIN (haut-gauche : cyan de marque ; bas-droit : rose) et
 * rejoint le violet vers le centre de l'écran — les deux se répondent au lieu de
 * s'ignorer. Le bleu et le cyan sont les barreaux de marque (`MXC_COLOR`) ; violet,
 * fuchsia et rose n'appartiennent à aucune échelle d'interface : c'est de
 * l'illustration, aucun texte ne s'y pose.
 */
/** Le violet où les deux vagues se rejoignent — nommé une fois, lu par les deux. */
const VAGUE_VIOLET = MEGGA_AI_VIOLET
const VAGUE_DEGRADE = {
  haut: `linear-gradient(135deg, ${MXC_COLOR.accentCyan} 0%, ${MXC_COLOR.accent} 45%, ${VAGUE_VIOLET} 80%, #a855f7 100%)`,
  bas: `linear-gradient(135deg, ${VAGUE_VIOLET} 0%, #c026d3 50%, #ec4899 85%, #f472b6 100%)`,
}

/** Une vague : le dégradé, découpé par les points du SVG. Sans masque chargé, rien ne s'affiche. */
function vagueStyle(masque: string, degrade: string, coin: 'haut' | 'bas'): React.CSSProperties {
  const url = `url("${masque}")`
  return {
    position: 'absolute', ...(coin === 'haut' ? { top: 0, left: 0 } : { bottom: 0, right: 0 }),
    width: VAGUE_LARGEUR, aspectRatio: '349 / 319.2', pointerEvents: 'none',
    backgroundImage: degrade, backgroundSize: '150% 150%',
    maskImage: url, WebkitMaskImage: url,
    maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
  }
}

/** Marque WhatsApp officielle en couleur (pastille verte) — étape 1 seulement. */
const WA_BRAND_SRC = '/contacts/whatsapp.svg'

/** Les encres de la couverture, une par thème. */
interface EncresCouverture { fond: string; ink: string; sub: string; pill: string; ring: string; glow: string }

/**
 * Sombre : les valeurs d'avant, à l'identique. Claire : le fond de carte et les
 * encres de la palette — `sub` tient l'AA sur blanc, un blanc à 60 % n'y tiendrait rien.
 */
function encresCouverture(sp: CrmPalette, dark: boolean): EncresCouverture {
  return dark
    ? { fond: MXC_COLOR.n100, ink: '#FFFFFF', sub: 'rgba(255,255,255,0.6)', pill: 'rgba(255,255,255,0.1)', ring: '#8DA4FF', glow: '0 0 24px rgba(255,255,255,0.5)' }
    : { fond: sp.cardBg, ink: sp.ink, sub: sp.sub, pill: sp.cardSubBg, ring: sp.accent, glow: 'none' }
}

// ── Tuile de la couverture : une icône, une ligne ─────────────────────
// <button> quand elle agit (WhatsApp, création), <div> inerte sinon : « Matching
// automatique » CONSTATE un comportement, elle n'ouvre aucun réglage — d'où son
// encre plus douce et l'absence de survol.
function CfrTile({ icon, label, onClick, encre, masque = false }: {
  icon: ReactNode
  label: string
  onClick?: () => void
  encre: EncresCouverture
  /** Invisible mais à sa place — le temps qu'un statut réponde, sans décaler la rangée. */
  masque?: boolean
}) {
  const body = (
    <>
      {/* Icône NUE, sans pastille ronde (Julien, 16.09.2026 : « enlève les ronds »). */}
      <span aria-hidden="true" style={{ height: 40, display: 'grid', placeItems: 'center' }}>
        {icon}
      </span>
      <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: onClick ? encre.ink : encre.sub, whiteSpace: 'nowrap' }}>{label}</span>
    </>
  )
  const shell: React.CSSProperties = {
    background: 'transparent', border: 0, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-2xl) var(--crm-space-4xl)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-lg)', fontFamily: 'inherit',
    visibility: masque ? 'hidden' : 'visible',
  }
  return onClick
    ? <button type="button" className="cfr-tile" onClick={onClick} style={{ ...shell, cursor: 'pointer' }}>{body}</button>
    : <div style={{ ...shell, cursor: 'default' }}>{body}</div>
}

// ── Skeleton « création de la fiche » — mime la mise en page de NewContactModal
//    pour enchaîner sans rupture sur le vrai formulaire. ─────────────────
function CfrBuildSkeleton({ sp, dark }: { sp: CrmPalette; dark: boolean }) {
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
  sp: CrmPalette
  dark: boolean
  onManual: () => void
}): JSX.Element {
  const { t } = useTranslation('contacts')
  const encre = encresCouverture(sp, dark)
  // Anneau de focus : clair sur le fond sombre (l'accent y serait un bleu foncé sur
  // presque-noir), l'accent sur le fond clair.
  const ring = encre.ring
  const [waOpen, setWaOpen] = useState(false)
  // ⛔ UN AGENT DÉJÀ CONNECTÉ NE DOIT PAS SE VOIR PROPOSER « CONNECTER WHATSAPP »
  // (Julien, 16.09.2026). Il a pu lier son numéro dans les Intégrations avant d'avoir
  // un seul contact : la tuile d'action devient alors un ÉTAT, comme « Matching
  // automatique ». Même source que la carte des Réglages — le lien VÉRIFIÉ, pas un
  // code d'appairage en cours. `isLoading` et non `isPending` : hors session la
  // requête est désactivée, `isPending` y resterait vrai et la tuile ne paraîtrait jamais.
  const { status: waStatut } = useWhatsAppPairing()
  const waConnecte = waStatut.data?.verified === true
  const waEnAttente = waStatut.isLoading
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
        position: 'absolute', inset: 0, background: encre.fond, overflowY: 'auto', overflowX: 'hidden', containerType: 'size',
        fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: encre.ink, fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`
        @keyframes cfrFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cfrOv { from { opacity: 0; } to { opacity: 1; } }
        .cfr-root button:focus-visible { outline: 2.5px solid ${ring}; outline-offset: 3px; }
        .cfr-root :focus:not(:focus-visible) { outline: none; }
        .cfr-tile { transition: background-color .15s ease; }
        .cfr-tile:hover { background: ${encre.pill}; }
        @keyframes cfrShimmer { 0% { background-position: -40% 0; } 100% { background-position: 160% 0; } }
        .cfr-build { animation: cfrOv .26s ease both; }
        .cfr-build-card { animation: cfrFadeUp .5s cubic-bezier(.2,.8,.2,1) both; }
        .cfr-sk { background-color: var(--sk); background-image: linear-gradient(90deg, transparent, var(--skHi), transparent);
          background-size: 220% 100%; background-repeat: no-repeat; animation: cfrShimmer 1.25s ease-in-out infinite; }
        /* La touche subtile : le dégradé glisse lentement dans les points, aller-retour,
           décalé d'une vague à l'autre pour qu'elles ne battent pas ensemble. Seule la
           position du fond bouge — ni le masque, ni la mise en page. */
        @keyframes cfrVague { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }
        .cfr-vague { animation: cfrVague 14s ease-in-out infinite alternate; }
        .cfr-vague--bas { animation-delay: -7s; }
        @media (prefers-reduced-motion: reduce) { .cfr-sk { animation: none; } .cfr-build-card { animation: none; } .cfr-vague { animation: none; background-position: 50% 50%; } }
        @media (max-width: 820px) { .cfr-steps { flex-direction: column; } }
      `}</style>

      {COVER && (
        <>
          <div aria-hidden="true" className="cfr-vague" style={vagueStyle(COVER.haut, VAGUE_DEGRADE.haut, 'haut')} />
          <div aria-hidden="true" className="cfr-vague cfr-vague--bas" style={vagueStyle(COVER.bas, VAGUE_DEGRADE.bas, 'bas')} />
        </>
      )}

      <div style={{
        position: 'relative', zIndex: 2, minHeight: '100%', boxSizing: 'border-box', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'calc(var(--crm-space-7xl) * 2)',
        padding: 'var(--crm-space-7xl)', animation: 'cfrFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}>
        <h1 style={{ margin: 0, textAlign: 'center', fontSize: 'var(--crm-text-8xl)', fontWeight: 500, letterSpacing: -1, lineHeight: 1.1, color: encre.ink, textShadow: encre.glow }}>
          {t('firstRun.title')}
        </h1>

        <div className="cfr-steps" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 'var(--crm-space-4xl)' }}>
          {/* Masquée tant que le statut n'a pas répondu : sinon un agent connecté verrait
              « Connecter WhatsApp » un instant, puis la tuile changer sous ses yeux. */}
          <CfrTile
            icon={(
              <span style={{ position: 'relative', display: 'block' }}>
                <img src={WA_BRAND_SRC} alt="" width="40" height="40" style={{ width: 40, height: 40, display: 'block' }} />
                {waConnecte && (
                  <span style={{ position: 'absolute', right: -6, bottom: -4, width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)', background: MXC_COLOR.accentGreen, boxShadow: `0 0 0 2px ${encre.fond}`, display: 'grid', placeItems: 'center' }}>
                    <MEIcon name="check" size={12} color={encreSur(MXC_COLOR.accentGreen)} strokeWidth={3} />
                  </span>
                )}
              </span>
            )}
            label={waConnecte ? t('firstRun.whatsappConnected') : t('firstRun.step1Cta')}
            onClick={waConnecte ? undefined : () => setWaOpen(true)}
            encre={encre}
            masque={waEnAttente}
          />
          {/* Sortie de secours : sans elle, un compte neuf sans WhatsApp ne peut rien créer. */}
          <CfrTile
            icon={<MEIcon name="plus" size={34} color={encre.ink} strokeWidth={2.4} />}
            label={t('firstRun.createContact')}
            onClick={openNew}
            encre={encre}
          />
          <CfrTile
            // Étoile à branches COURBES en trait épais (16.09.2026) : l'étoile de `NcvIcon`,
            // un losange fin à 1,8, se lisait mal à côté de la marque WhatsApp.
            icon={<MEIcon name="sparkle" size={34} color={encre.ink} strokeWidth={2.4} />}
            label={t('firstRun.matchingAuto')}
            encre={encre}
          />
        </div>
      </div>

      {building && <CfrBuildSkeleton sp={sp} dark={dark} />}

      <WhatsAppConnectModal open={waOpen} onClose={() => setWaOpen(false)} sp={sp} dark={dark} />
    </div>
  )
}
