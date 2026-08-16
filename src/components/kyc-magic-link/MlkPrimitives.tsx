// MEGGA — Primitives Sugar Pure pour le parcours client KYC Magic Link
// Sprint 4.7.C — Calque pixel-près de handoff-kyc-magic-link/maquette/megga-kyc-magic-link.jsx
// (préfixe Mlk* conservé pour fidélité au canon Claude Design).
//
// Important : ces primitives sont AUTONOMES (ne dépendent ni de DossierTokens ni
// du layout agent). Elles servent UNIQUEMENT les écrans publics `/kyc/<token>`
// que la cliente consulte sans compte MEGGA.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
// Jetons déplacés dans mlkTokens.ts : ce fichier n'exporte que des composants
// (contrainte Fast Refresh). Voir l'en-tête de mlkTokens.ts.
import { MLK, MLK_STATUT } from './mlkTokens'
import { crmVoileEncre } from '@/components/crm/tokens'
import { encreSur } from '@/components/megga-x-crm/tokens'

/**
 * ⛔ LES PAGES LÉGALES VIVENT SUR LA VITRINE, ET CE PIED POINTAIT DANS LE VIDE.
 *
 * Jusqu'au 17 août 2026, `MlkFooter` écrivait `/mentions-legales` et
 * `/confidentialite` en chemins RELATIFS. Aucune des deux n'est déclarée dans
 * `src/App.tsx` ni dans `public/_redirects` : sur `app.megga.ch`, le repli SPA
 * rendait 200 puis `NotFoundPage`. Un client à qui on demande son passeport
 * cliquait « Confidentialité » et tombait sur une page introuvable — sur les
 * SEIZE sites où ce pied est rendu.
 *
 * Les alias existent, mais chez le voisin : `sites/megga-vitrine/_worker.js`
 * mappe `/mentions-legales → /legal` et `/confidentialite → /privacy`. Il ne
 * manquait donc que l'ORIGINE.
 *
 * ⚠ ET CES DEUX CIBLES SONT HORS DU GATE DE LA VITRINE, par décision écrite :
 * `PUBLIC_PAGES` y retient `/legal`, `/privacy` et `/terms` parce que la case de
 * consentement de l'inscription y renvoie — « un consentement à un texte
 * illisible » sinon. Les liens tiennent donc que le gate soit ouvert ou fermé.
 *
 * ⚠ EN DUR, comme `VITRINE_URL` (src/App.tsx) et l'endpoint de `geoLanguage.ts`,
 * et pour la raison qu'ils écrivent : c'est une constante de DÉPLOIEMENT, pas une
 * configuration. Une `VITE_*` absente du build rendrait ici une URL vide et le
 * lien échouerait en silence au lieu d'échouer à la construction.
 */
const VITRINE_MENTIONS_LEGALES = 'https://megga.ch/mentions-legales'
const VITRINE_CONFIDENTIALITE = 'https://megga.ch/confidentialite'

// ─── Icônes line-stroke (subset utilisé par les écrans clients) ───────────

type MlkIconName =
  | 'check'
  | 'checkCircle'
  | 'lock'
  | 'shield'
  | 'swiss'
  | 'clock'
  | 'file'
  | 'fileText'
  | 'upload'
  | 'camera'
  | 'arrowR'
  | 'arrowL'
  | 'x'
  | 'chevronR'
  | 'alert'
  | 'mail'
  | 'id'
  | 'home'
  | 'coins'
  | 'scale'
  | 'flag'
  | 'refresh'

const PATHS: Record<MlkIconName, ReactNode> = {
  check: <path d="m5 13 4 4 10-12" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
  swiss: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 7h6v3h3v4h-3v3H9v-3H6v-4h3z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
    </>
  ),
  fileText: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  arrowR: <path d="M5 12h14M12 5l7 7-7 7" />,
  arrowL: <path d="M19 12H5M12 19l-7-7 7-7" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  chevronR: <path d="m9 6 6 6-6 6" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  id: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M14 10h4M14 14h4" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v9h14v-9" />
    </>
  ),
  coins: (
    <>
      <circle cx="9" cy="9" r="6" />
      <circle cx="15" cy="15" r="6" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18" />
      <path d="M5 8h14" />
      <path d="m5 8-2 5a4 4 0 0 0 8 0Z" />
      <path d="m19 8-2 5a4 4 0 0 0 8 0Z" />
    </>
  ),
  flag: (
    <>
      <path d="M4 21V4" />
      <path d="M4 5h13l-2 4 2 4H4" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
}

interface MlkIconProps {
  name: MlkIconName
  size?: number
  stroke?: string
  sw?: number
}

export function MlkIcon({ name, size = 22, stroke = 'currentColor', sw = 1.6 }: MlkIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}

// ─── Boutons signature ────────────────────────────────────────────────────

interface BlackPillProps {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  iconRight?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  type?: 'button' | 'submit'
}

export function MlkBlackPill({
  children,
  onClick,
  icon,
  iconRight,
  disabled,
  size = 'lg',
  full,
  type = 'button',
}: BlackPillProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'lg' ? 54 : size === 'md' ? 46 : 38
  const pad = size === 'lg' ? '0 28px' : size === 'md' ? '0 22px' : '0 18px'
  const fs = size === 'lg' ? 15 : size === 'md' ? 14 : 12.5
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: pad,
        borderRadius: 999,
        border: 0,
        // ⚠ Le survol ne change pas de TEINTE, il est GÉOMÉTRIQUE — le
        // `translateY(-1px)` et l'ombre renforcée plus bas le portaient déjà.
        // `MLK.blackHover` était donc un troisième signal pour le même état, et
        // la direction ne donne pas de variante de ton à l'affordance (même
        // retrait qu'au chantier KYC sur `kycPalette.blackHover`).
        background: disabled ? MLK.ghost : MLK.accent,
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: full ? 'flex' : 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        whiteSpace: 'nowrap',
        width: full ? '100%' : 'auto',
        boxShadow: disabled
          ? 'none'
          : hover
            ? `0 14px 32px ${crmVoileEncre(false, 0.28)}`
            : `0 8px 20px ${crmVoileEncre(false, 0.20)}`,
        transform: hover && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .18s ease',
      }}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
}


// ─── Wordmark, Avatar, ReassureRow, Footer, Shell ─────────────────────────

export function MlkWordmark({ size = 18 }: { size?: number }) {
  // Fallback wordmark texte si l'image ne charge pas
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <img
        src="/megga-logo.svg"
        alt="MEGGA"
        style={{
          height: size * 0.85,
          width: 'auto',
          display: 'block',
        }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          const sib = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null
          if (sib) sib.style.display = 'block'
        }}
      />
      <div
        style={{
          display: 'none',
          fontFamily: 'Manrope, sans-serif',
          fontSize: size,
          fontWeight: 600,
          letterSpacing: -1.5,
          color: MLK.ink,
        }}
      >
        MEGGA
      </div>
    </div>
  )
}

/**
 * La pastille de l'agent, sur les écrans que le CLIENT voit.
 *
 * ⛔ ELLE RENDAIT 3,68:1, ET C'EST LE PREMIER ET LE DERNIER ÉCRAN DU PARCOURS.
 * Son aplat était `#3B82F6` — le blue-500 brut de Tailwind, ABSENT de l'échelle
 * MEGGA X — sous une encre blanche FIGÉE. Les initiales rendent 15,6 à 16,3 px
 * en graisse 600, donc du texte NORMAL au sens WCAG : le seuil est 4,5, pas 3.
 *
 * ⚠ LE DÉPÔT AVAIT DÉJÀ MESURÉ CETTE VALEUR, DEUX FOIS, et corrigé le jumeau —
 * `globals.css` écrit que `#3B82F6` « ne porte pas l'encre blanche : 3,68:1 »,
 * et `crm-wizard/primitives.tsx` DÉRIVE son encre par `encreSur` depuis que
 * cinq des huit couleurs d'avatar y échouaient l'AA. Le correctif existait donc
 * côté AGENT et manquait côté CLIENT. Défaut propagé par copie, pas par oubli
 * de mesure.
 *
 * ⛔ POURQUOI L'ENCRE, ET PAS UN BLEU PLUS SOMBRE. `BuyerReceptionPage` — l'autre
 * surface où un client voit la pastille de son conseiller — la peint déjà
 * `MLK.ink` sous blanc. Deux avatars clients ne doivent pas différer. Et c'est
 * l'arbitrage rendu quatre fois dans ce dépôt : un avatar est une DONNÉE, rien
 * ne s'y actionne, donc il garde l'encre au lieu de prendre l'accent.
 * Mesuré : 3,68:1 → 20,62:1.
 *
 * ⚠ L'ENCRE EST DÉRIVÉE, pas réécrite en dur, et ça ferme la CLASSE plutôt que
 * ce cas : `encreSur` choisit le barreau lisible de l'aplat reçu, donc un
 * appelant qui passerait une couleur ne peut plus retomber sous le seuil. Le
 * halo suit l'aplat par construction.
 */
export function MlkAgentAvatar({
  name,
  color = MLK.ink,
  size = 56,
}: {
  name: string
  color?: string
  size?: number
}) {
  const parts = name.split(/\s+/).filter(Boolean)
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        color: encreSur(color),
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.max(13, size * 0.34),
        fontWeight: 600,
        flexShrink: 0,
        boxShadow: `0 0 0 4px ${color}26`,
      }}
    >
      {initials.toUpperCase() || 'A'}
    </div>
  )
}

interface ReassureItem {
  icon: MlkIconName
  title: string
  sub: string
}

export function MlkReassureRow({ items }: { items: ReassureItem[] }) {
  // Desktop : N colonnes (1 par item). Mobile < 560px : 2 colonnes (grid auto-fit).
  // Le CSS @media est injecté en bas via MlkBackground (composant racine).
  return (
    <div className="mlk-reassure-row" data-cols={items.length}>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '16px 4px 4px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: MLK.cardSubtle,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <MlkIcon name={it.icon} size={17} stroke={MLK.ink} sw={1.7} />
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-md)',
              fontWeight: 600,
              color: MLK.ink,
              letterSpacing: -0.1,
              marginTop: 2,
            }}
          >
            {it.title}
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-xs)',
              color: MLK.muted,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {it.sub}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * La bannière qui dit qu'un geste de rendez-vous n'a pas abouti.
 *
 * ⛔ ELLE ÉTAIT ÉCRITE TROIS FOIS, À L'IDENTIQUE — `MlkBooking` (réservation) et
 * les DEUX sites d'`AppointmentManagePage` (report, annulation). Pas seulement le
 * même style : le même appel `t()`, au même défaut. Un premier correctif l'avait
 * extraite en local dans la page, ce qui laissait la troisième copie dans l'état
 * d'origine et creusait l'écart au lieu de le fermer. Elle vit donc ICI, avec les
 * autres pièces partagées de la face publique.
 *
 * ⛔ SES COULEURS PASSENT À `MLK_STATUT`, ET L'ENCRE CHANGE PAR ARBITRAGE, PAS PAR
 * CORRECTION. Le rouge sortant tenait déjà l'AA : `#B42318` sur `#FEF2F2` rend
 * 6,01:1, contre 5,91:1 pour `MLK_STATUT.errInk`. Le sortant était donc MEILLEUR,
 * de 0,10 — sous le seuil de ce qu'un œil distingue. Ce qui les départage est
 * l'UNICITÉ : `errInk` nomme ce rôle sur toute la face publique, et une encre
 * d'erreur qui diffère d'un écran à l'autre est l'incohérence que ce chantier
 * retire. Même arbitrage, même raison, que l'ambre de `mlkTokens`. Les deux
 * chiffres sont écrits pour qu'on puisse revenir dessus.
 *
 * ⚠ Le filet est AJOUTÉ : les deux pages de visite peignent leur bannière de refus
 * `fill` + `line`, celle-ci n'avait que son aplat.
 *
 * ⚠ LA PROP DE STYLE NE PORTE QUE DES MARGES, et c'est délibéré : les trois sites
 * ne différaient que par là. Un `CSSProperties` complet étalé en dernier aurait
 * rendu réécrasables l'aplat, l'encre et le filet que cette extraction verrouille.
 */
export function MlkFailureNotice({
  code,
  style,
}: {
  code: string
  style?: Pick<CSSProperties, 'margin' | 'marginTop' | 'marginBottom'>
}) {
  const { t } = useTranslation('kyc')
  return (
    <div
      style={{
        padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-lg)',
        background: MLK_STATUT.errFill,
        boxShadow: `inset 0 0 0 1px ${MLK_STATUT.errLine}`,
        fontSize: 'var(--crm-text-md)',
        color: MLK_STATUT.errInk,
        fontWeight: 500,
        lineHeight: 1.5,
        ...style,
      }}
    >
      {/* `slot_taken` n'est pas une erreur du client : quelqu'un a simplement pris
          le créneau entre l'affichage et le clic. La liste est déjà rechargée par
          le hook — on l'invite à en choisir un autre. */}
      {t(`client.booking.error_${code}`, { defaultValue: t('client.booking.error_default') })}
    </div>
  )
}

export function MlkFooter() {
  // ⛔ `rel="noreferrer"` empêche le token magic-link de fuiter dans le header
  // Referer envoyé aux pages externes. La précaution était déjà juste ; elle
  // devient INDISPENSABLE depuis que les liens sont absolus, donc CROSS-ORIGINE :
  // sans elle, `app.megga.ch/kyc/<token>` partirait en clair vers megga.ch.
  // `target="_blank"` ouvre dans un nouvel onglet pour préserver le parcours.
  //
  // ⚠ LES LIBELLÉS ÉTAIENT EN DUR EN FRANÇAIS sur une face servie en quatre
  // langues — le parcours KYC rend 51 chaînes traduites et finissait sur deux
  // mots qui ne l'étaient pas. Les valeurs viennent de `sites/megga-vitrine/i18n/`,
  // reprises telles quelles : le pied nomme la page exactement comme la page
  // qu'il ouvre se nomme elle-même.
  const { t } = useTranslation('common')
  return (
    <div
      style={{
        marginTop: 32,
        paddingTop: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        fontSize: 'var(--crm-text-xs)',
        color: MLK.muted,
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', gap: 18 }}>
        <a
          href={VITRINE_MENTIONS_LEGALES}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {t('legal.notice')}
        </a>
        <a
          href={VITRINE_CONFIDENTIALITE}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {t('legal.privacy')}
        </a>
      </div>
    </div>
  )
}

interface ShellProps {
  children: ReactNode
  width?: number
  pad?: number
  style?: CSSProperties
}

export function MlkShell({ children, width = 720, pad = 56, style }: ShellProps) {
  // Padding et border-radius adaptés mobile via classe + @media query
  // (injectée par MlkBackground). Sur mobile : padding réduit, radius plus serré.
  return (
    <div
      style={{
        width: '100%',
        fontFamily: MLK.font,
        color: MLK.ink,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        className="mlk-shell"
        style={
          {
            width,
            maxWidth: 'calc(100vw - 32px)',
            background: MLK.card,
            borderRadius: 32,
            boxShadow: MLK.shadowLg,
            // Variable CSS lue par @media query pour mobile
            ['--mlk-shell-pad' as string]: `${pad}px`,
            padding: 'var(--mlk-shell-pad)',
            animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
            ...style,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}

// Page-level background gradient (used by KycPublicPage)
export function MlkBackground({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: MLK.bgGradient,
        padding: '48px 16px',
        fontFamily: MLK.font,
        color: MLK.ink,
      }}
    >
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Grid réassurance : N colonnes desktop, 2 colonnes < 560px */
        .mlk-reassure-row {
          display: grid;
          gap: 16px;
        }
        .mlk-reassure-row[data-cols="1"] { grid-template-columns: 1fr; }
        .mlk-reassure-row[data-cols="2"] { grid-template-columns: repeat(2, 1fr); }
        .mlk-reassure-row[data-cols="3"] { grid-template-columns: repeat(3, 1fr); }
        .mlk-reassure-row[data-cols="4"] { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 560px) {
          .mlk-reassure-row[data-cols="3"],
          .mlk-reassure-row[data-cols="4"] {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        /* Shell padding réduit sur mobile pour gagner de l'espace */
        @media (max-width: 560px) {
          .mlk-shell {
            padding: calc(var(--mlk-shell-pad) * 0.5) !important;
            border-radius: 22px !important;
          }
        }
        /* Titres H1 plus petits sur mobile (pas de débordement < 380px).
           ⛔ ELLE NE DOIT JAMAIS AGRANDIR, et elle le faisait. Cette règle
           s'applique à TOUS les .mlk-h1, dont le plus petit vaut 24 px : à
           26 px, trois titres sortaient PLUS GRANDS sur téléphone que sur
           bureau. Le défaut préexistait sur un site (l'écran de lien expiré) ;
           la descente des tailles du lot 3 en a révélé deux autres.
           Le barreau 5xl est le plancher des h1 de cette face — la règle
           rétrécit toujours, ou ne fait rien. */
        @media (max-width: 480px) {
          .mlk-h1 {
            font-size: var(--crm-text-5xl) !important;
            letter-spacing: -0.5px !important;
            line-height: 1.15 !important;
          }
        }
      `}</style>
      {children}
    </div>
  )
}
