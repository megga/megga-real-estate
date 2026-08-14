/**
 * Kit de la console admin — atomes de rendu, en grammaire MEGGA X.
 *
 * Encode la grammaire de la direction pour que les 19 pages d'administration
 * cessent de la réinventer :
 *   - bento séparé par la BORDURE, jamais par une ombre (en sombre `sp.shadow`
 *     vaut `'none'` : c'est un trait de la direction, pas un oubli) ;
 *   - accent `#424bfb` sur les contrôles, violet réservé au repère de contexte
 *     du rail (`AdminShell`, trois sites) ;
 *   - statuts en pilules à fond plein dont l'encre est DÉRIVÉE de l'aplat
 *     (`encreSur`), jamais choisie — un aplat clair prend l'encre sombre ;
 *   - quatre rayons seulement (`ADMIN_RADII`) ;
 *   - chiffres tabulaires, icônes à stroke 1.7 ;
 *   - graisses 500/600, jamais au-delà : c'est l'encre qui porte la hiérarchie.
 *
 * ⚠ Cet en-tête décrivait « Sugar Pure », « l'accent noir unique » et « texte
 * blanc » jusqu'au 14 août 2026 — une norme retirée du CRM le 10. Un fichier
 * aligné sur une référence périmée se relit MOINS qu'un fichier négligé : il a
 * l'air tenu.
 *
 * Les atomes lisent le thème eux-mêmes via `useAdminSugar()` : les pages ne
 * portent aucune prop de palette. Constantes et types dans `adminKitCore.ts`
 * (règle `react-refresh/only-export-components`).
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAdminSugar, type AdminTones } from '@/hooks/useAdminSugar'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { ADMIN_ICON_SIZE, ADMIN_ICON_STROKE, ADMIN_RADII, type AdminToneName } from './adminKitCore'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'

/* ─── Icône ─────────────────────────────────────────────────────────────────── */

/**
 * Icône de la console, calibrée sur la grammaire Sugar.
 *
 * Les Réglages dessinent leurs tracés à la main (`PfIc`, stroke 1.7). Remplacer
 * les 33 fichiers qui importent `lucide-react` par des tracés maison coûterait
 * cher pour un écart quasi invisible : lucide est déjà du SVG stroke. On
 * normalise donc la TAILLE et l'ÉPAISSEUR — c'est ce qui se voit — et on garde
 * la bibliothèque.
 */
export function AdminIc({ icon: Icon, size = ADMIN_ICON_SIZE, color, style }: {
  icon: LucideIcon
  size?: number
  color?: string
  style?: CSSProperties
}) {
  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={ADMIN_ICON_STROKE}
      style={{ flexShrink: 0, display: 'block', color, ...style }}
    />
  )
}

/* ─── Bento ─────────────────────────────────────────────────────────────────── */

/**
 * Carte de la console — le bento.
 *
 * ⚠ Séparée du fond par sa BORDURE. En clair une ombre courte l'accompagne ; en
 * sombre `sp.shadow` vaut `'none'` et l'écart de luminance avec le canvas est
 * de 1,036:1 — c'est-à-dire imperceptible, PAR CHOIX. Ne pas « réparer » en
 * ajoutant une ombre sombre ou en creusant l'écart : la séparation vient de la
 * bordure (`CLAUDE.md` §3).
 */
export function AdminCard({ children, padding = 20, radius = ADMIN_RADII.card, className, style, onClick }: {
  children: ReactNode
  padding?: number | string
  radius?: number
  className?: string
  style?: CSSProperties
  onClick?: () => void
}) {
  const { surf } = useAdminSugar()
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: surf.card,
        borderRadius: radius,
        border: surf.hairline,
        boxShadow: surf.shadow,
        padding,
        minWidth: 0,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Filet de séparation interne d'un bento (l'équivalent de `hairSoft` des Réglages). */
export function AdminDivider({ margin = '0' }: { margin?: string }) {
  const { dark } = useAdminSugar()
  return <div style={{ height: 1, background: sgVoileEncre(dark, 0.07), margin }} />
}

/* ─── Titres ────────────────────────────────────────────────────────────────── */

/**
 * Titre de groupe dans un bento : pastille de ton + libellé.
 *
 * Reprend la grammaire des groupes de `ProfileFocusSection` (pastille 8 px,
 * libellé 12/800). La pastille est le SEUL endroit où une couleur vive sert de
 * repère — un badge à fond coloré, lui, passe par `AdminPill`.
 *
 * Rend un VRAI titre (`h2` par défaut) et non un `span` : ce composant remplace
 * les `<h2>` des pages, et un rail de titres réduit au seul `<h1>` d'`AdminPage`
 * prive le rotor de VoiceOver et la touche H de NVDA de tout niveau
 * intermédiaire. `level={3}` pour un sous-groupe imbriqué dans une section qui a
 * déjà son `h2`.
 */
export function AdminGroupTitle({ label, tone = 'info', right, level = 2 }: {
  label: string
  tone?: AdminToneName
  right?: ReactNode
  level?: 2 | 3 | 4
}) {
  const { sp, tones } = useAdminSugar()
  const Heading = (`h${level}` as const) satisfies 'h2' | 'h3' | 'h4'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-xl) var(--crm-space-lg) var(--crm-space-md)' }}>
      <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: toneColor(tone, tones), flexShrink: 0 }} />
      <Heading style={{ margin: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: 0.2, color: sp.ink }}>{label}</Heading>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>{right}</div>}
    </div>
  )
}

/* ─── Pilules ───────────────────────────────────────────────────────────────── */

/** Résout un nom de ton en couleur, `neutral` compris. */
function toneColor(tone: AdminToneName, tones: AdminTones): string {
  switch (tone) {
    case 'ok': return tones.ok
    case 'warn': return tones.warn
    case 'err': return tones.err
    case 'info': return tones.info
    case 'cyan': return tones.cyan
    case 'accent': return tones.accent
    case 'neutral': return tones.neutralBg
  }
}

/**
 * Pilule de statut — fond plein, texte blanc, rayon 999.
 *
 * Remplace les 91 fonds `bg-<couleur>-<n>` et les 123 textes colorés relevés à
 * l'audit. `neutral` est le seul ton qui garde un texte encre : un statut sans
 * signal ne doit pas crier.
 */
export function AdminPill({ label, tone = 'neutral', icon, title, style }: {
  label: string
  tone?: AdminToneName
  icon?: LucideIcon
  title?: string
  style?: CSSProperties
}) {
  const { tones, onTone } = useAdminSugar()
  // Un libellé vide ne doit pas peindre une pilule : une facture sans statut
  // affichait un rectangle de couleur vide au lieu de ne rien afficher.
  if (!label && !icon) return null
  const neutral = tone === 'neutral'
  const bg = toneColor(tone, tones)
  // L'encre se DÉRIVE de l'aplat : un ton clair prend l'encre sombre, et
  // inversement. Le blanc constant d'avant faisait tomber les six pilules
  // sombres entre 2,38:1 et 3,57:1. `neutral` garde son encre propre — c'est le
  // seul ton qui dit « pas de signal », il ne doit pas crier.
  const ink = neutral ? tones.neutralInk : onTone(bg)
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)',
        padding: icon ? '5px 12px 5px 9px' : '5px 12px',
        borderRadius: ADMIN_RADII.pill,
        background: bg, color: ink,
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: -0.1,
        whiteSpace: 'nowrap', flexShrink: 0,
        ...style,
      }}
    >
      {icon && <AdminIc icon={icon} size={13} color={ink} />}
      {label}
    </span>
  )
}

/* ─── Boutons ───────────────────────────────────────────────────────────────── */

/**
 * Voile de l'état DÉSACTIVÉ, et ce n'est pas un réglage à l'œil.
 *
 * ⛔ Il valait 0,5, et sur le bouton PRINCIPAL — encre inversée sur l'accent —
 * ça donnait 2,26:1 : « Publier maintenant » était illisible avant saisie.
 * Mesuré à l'écran sur `/dev/admin` puis à la source, dans les deux thèmes et
 * sur les deux fonds que la console pose sous un bouton.
 *
 * 0,7 est le PLUS PETIT voile qui franchit 3:1 dans les cinq cas (le pire vaut
 * alors 3,29:1). Il est donc dérivé de la mesure, pas choisi — et le voile
 * reste un voile : `cursor: not-allowed` et l'attribut `disabled` continuent de
 * porter le sens, l'opacité ne fait que l'appuyer.
 *
 * ⚠ Le seuil est 3:1 et non l'AA : la WCAG 1.4.3 exempte explicitement les
 * commandes inactives. On refuse l'illisible, on n'invente pas une exigence.
 */
const VOILE_DESACTIVE = 0.7

/**
 * Bouton secondaire : surface de carte + ombre courte, texte encre.
 *
 * La classe `.adm-ghost` porte le survol : le fond de repos étant déclaré en
 * inline, une règle `:hover` d'auteur ne pourrait pas l'atteindre sans elle
 * (cf. `admin-console.css`). `className` est exposée pour composer, mais la
 * classe de survol est toujours ajoutée.
 */
export function AdminGhostBtn({ children, onClick, icon, disabled, title, style, className, expanded, hasPopup, label }: {
  children: ReactNode
  onClick?: () => void
  icon?: LucideIcon
  disabled?: boolean
  title?: string
  style?: CSSProperties
  className?: string
  /**
   * État d'un déclencheur de menu (`aria-expanded`).
   *
   * Ces trois props existent parce que le type ci-dessus est FERMÉ et qu'aucune
   * prop n'est propagée au `<button>` : poser `aria-expanded` directement sur ce
   * composant ne lèverait aucune erreur — TypeScript ne contrôle pas les
   * attributs JSX à trait d'union — et l'attribut serait silencieusement perdu.
   * Le correctif ressemblerait à un correctif sans en être un.
   */
  expanded?: boolean
  hasPopup?: boolean
  /** Nom accessible quand le contenu visible n'en tient pas lieu. */
  label?: string
}) {
  const { sp, surf } = useAdminSugar()
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      aria-expanded={expanded}
      aria-haspopup={hasPopup ? 'menu' : undefined}
      aria-label={label}
      className={className ? `adm-ghost ${className}` : 'adm-ghost'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        height: 34, padding: '0 var(--crm-space-2xl)', borderRadius: ADMIN_RADII.pill, border: 0,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? VOILE_DESACTIVE : 1,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
        color: sp.ink, background: surf.card, boxShadow: sp.shadowSm,
        ...style,
      }}
    >
      {icon && <AdminIc icon={icon} size={15} color={sp.ink} />}
      {children}
    </button>
  )
}

/**
 * Bouton principal : l'accent `#424bfb` (`sp.accent`), encre `sp.accentInk`.
 *
 * ⚠ L'accent de la direction, PAS le violet : celui-ci reste un repère de
 * contexte — « tu es dans la console » — et vit aux trois sites du rail. Un
 * bouton d'action n'est pas un repère de contexte.
 */
export function AdminSolidBtn({ children, onClick, icon, disabled, title, style }: {
  children: ReactNode
  onClick?: () => void
  icon?: LucideIcon
  disabled?: boolean
  title?: string
  style?: CSSProperties
}) {
  const { sp } = useAdminSugar()
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        height: 34, padding: '0 var(--crm-space-3xl)', borderRadius: ADMIN_RADII.pill, border: 0,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? VOILE_DESACTIVE : 1,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
        color: sp.accentInk, background: sp.accent, boxShadow: sp.shadowSm,
        ...style,
      }}
    >
      {icon && <AdminIc icon={icon} size={15} color={sp.accentInk} />}
      {children}
    </button>
  )
}

/**
 * Interrupteur Sugar — piste encre à l'état actif, pouce blanc.
 *
 * Remplace les icônes `ToggleLeft`/`ToggleRight` de la page Feature Flags : une
 * icône n'a pas d'état pressé, ne se règle pas au clavier et ne dit pas au
 * lecteur d'écran qu'elle est un interrupteur.
 */
export function AdminSwitch({ on, onClick, label, disabled }: {
  on: boolean
  onClick?: () => void
  label?: string
  disabled?: boolean
}) {
  const { sp, dark } = useAdminSugar()
  return (
    <button
      onClick={onClick} role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      style={{
        width: 44, height: 26, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? VOILE_DESACTIVE : 1, flexShrink: 0,
        background: on ? sp.accent : (dark ? 'rgba(255,255,255,0.16)' : '#D5DAE2'),
        position: 'relative', transition: 'background .22s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20,
        // ⛔ Le pouce portait `#0B0C0E`, le noir de SUGAR — la direction retirée.
        // Il survivait ici parce qu'aucune garde ne balayait ce dossier ; c'est
        // le seul du périmètre. Les deux pôles sont ceux de l'échelle.
        borderRadius: ADMIN_RADII.pill, background: dark && on ? MXC_COLOR.n100 : MXC_COLOR.n1000,
        transition: 'left .22s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
      }} />
    </button>
  )
}

/* ─── Avatar ────────────────────────────────────────────────────────────────── */

/**
 * Avatar à initiales — fond encre uni.
 *
 * Trois pages tiraient leur fond dans un tableau arc-en-ciel
 * (`bg-emerald-500`, `bg-amber-500`, `bg-rose-500`…). Sugar n'a qu'un fond
 * d'avatar : l'encre, initiales en `accentInk`.
 *
 * La photo passe par un vrai `<img>` et non par un `background-image` : une
 * image de fond n'a ni texte alternatif, ni chargement différé, et surtout
 * aucun repli — une `avatar_url` en 404 laissait un disque vide, sans même les
 * initiales. Ici l'erreur de chargement retombe sur les initiales.
 */
export function AdminAvatar({ initials, size = 34, photo, alt }: {
  initials: string
  size?: number
  photo?: string | null
  alt?: string
}) {
  const { sp } = useAdminSugar()
  const [broken, setBroken] = useState(false)
  const showPhoto = !!photo && !broken

  return (
    <div
      style={{
        position: 'relative',
        width: size, height: size, borderRadius: ADMIN_RADII.pill, flexShrink: 0, overflow: 'hidden',
        background: sp.accent, color: sp.accentInk, display: 'grid', placeItems: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 600, letterSpacing: -0.4,
      }}
    >
      {/* Les initiales restent rendues DESSOUS : si l'image échoue en cours de
          route, le repli est déjà en place, sans reflux de mise en page. */}
      <span aria-hidden={showPhoto || undefined}>{initials}</span>
      {showPhoto && (
        <img
          src={photo}
          alt={alt ?? ''}
          loading="lazy"
          onError={() => setBroken(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  )
}

/* ─── Indicateur ────────────────────────────────────────────────────────────── */

/**
 * Indicateur chiffré (KPI) en grammaire Sugar.
 *
 * Le chiffre est en `tabular-nums` — sans quoi une colonne de compteurs qui se
 * rafraîchit tremble à chaque changement de largeur de glyphe.
 */
export function AdminStat({ label, value, icon, tone, hint, trend }: {
  label: string
  value: string | number
  icon?: LucideIcon
  tone?: AdminToneName
  hint?: string
  trend?: number
}) {
  const { sp, tones } = useAdminSugar()
  const iconColor = tone ? toneColor(tone, tones) : sp.sub
  return (
    <AdminCard padding="14px 16px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
        {icon && <AdminIc icon={icon} size={16} color={iconColor} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.6, color: sp.ink, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </div>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, lineHeight: 1.3, marginTop: 1 }}>{label}</div>
          {hint && <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, marginTop: 2 }}>{hint}</div>}
        </div>
        {trend != null && trend !== 0 && (
          <span style={{
            fontSize: 'var(--crm-text-sm)', fontWeight: 600, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
            color: trend > 0 ? tones.ok : tones.err,
          }}>
            {trend > 0 ? '+' : ''}{trend}
          </span>
        )}
      </div>
    </AdminCard>
  )
}

/* ─── États ─────────────────────────────────────────────────────────────────── */

/** État vide d'un bento — icône éteinte, message sobre, action optionnelle. */
export function AdminEmpty({ icon, title, hint, action }: {
  icon?: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}) {
  const { sp } = useAdminSugar()
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 'var(--crm-space-lg)', padding: '44px 20px', textAlign: 'center' }}>
      {icon && <AdminIc icon={icon} size={26} color={sp.sub} />}
      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, letterSpacing: -0.2 }}>{title}</div>
      {hint && <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, maxWidth: 380, lineHeight: 1.5 }}>{hint}</div>}
      {action}
    </div>
  )
}

/**
 * Bloc de chargement — même rayon que la ligne qu'il remplace.
 *
 * Décoratif par défaut (`aria-hidden`) : un squelette n'a rien à annoncer, et en
 * empiler quatre produirait quatre annonces. Le bloc qui remplace un texte
 * « Chargement… » passe `label` — il devient alors la région `role="status"`
 * qui porte l'annonce, une seule fois.
 */
export function AdminSkeleton({ height = 40, radius = ADMIN_RADII.row, width = '100%', label }: {
  height?: number
  radius?: number
  width?: number | string
  label?: string
}) {
  const { surf } = useAdminSugar()
  return (
    <div
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-busy={label ? true : undefined}
      aria-hidden={label ? undefined : true}
      style={{ height, width, borderRadius: radius, background: surf.cardSub, animation: 'admPulse 1.5s ease-in-out infinite' }}
    />
  )
}

/** État d'erreur d'un bento, avec relance. */
export function AdminError({ message, onRetry, retryLabel }: {
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  const { tones } = useAdminSugar()
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 'var(--crm-space-xl)', padding: '36px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tones.err }}>{message}</div>
      {onRetry && retryLabel && <AdminGhostBtn onClick={onRetry}>{retryLabel}</AdminGhostBtn>}
    </div>
  )
}

/* ─── Tableau ───────────────────────────────────────────────────────────────── */

/** En-tête de colonne — casse normale, jamais d'UPPERCASE (règle CLAUDE.md). */
export function AdminTh({ children, align = 'left', width, bg }: {
  children: ReactNode
  align?: 'left' | 'right' | 'center'
  width?: number | string
  /**
   * Fond de l'en-tête collant. Par défaut la surface de table, qui suppose un
   * tableau posé dans une carte. Un tableau posé à MÊME le fond de page doit
   * passer `sp.pageBg` : sinon une couture apparaît au défilement, exactement
   * la ligne que la grammaire « liste nue » cherche à supprimer.
   */
  bg?: string
}) {
  const { sp } = useAdminSugar()
  return (
    <th style={{
      textAlign: align, width, padding: 'var(--crm-space-md) var(--crm-space-xl)', whiteSpace: 'nowrap',
      fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.1, color: sp.sub,
      background: bg ?? sp.tableHeadBg, position: 'sticky', top: 0, zIndex: 1,
    }}>
      {children}
    </th>
  )
}

/** Cellule — chiffres tabulaires quand `numeric`, pour que les colonnes s'alignent. */
export function AdminTd({ children, align = 'left', numeric, style }: {
  children: ReactNode
  align?: 'left' | 'right' | 'center'
  numeric?: boolean
  style?: CSSProperties
}) {
  const { sp, dark } = useAdminSugar()
  return (
    <td style={{
      textAlign: align, padding: 'var(--crm-space-lg) var(--crm-space-xl)', fontSize: 'var(--crm-text-md)', color: sp.ink,
      borderTop: `1px solid ${sgVoileEncre(dark, 0.06)}`,
      fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
      ...style,
    }}>
      {children}
    </td>
  )
}

/* ─── Recherche et pagination ───────────────────────────────────────────────── */

/**
 * Champ de recherche à loupe intégrée.
 *
 * Six écrans le recopiaient — même géométrie, même surface creuse, et chacun sa
 * classe pour la couleur du placeholder et l'anneau de focus. Ces deux règles
 * vivent désormais une seule fois, dans le shell (`.adm-search`).
 *
 * `label` est le nom accessible : le champ n'a pas d'étiquette visible, la loupe
 * ne se lit pas, et le placeholder ne fait pas office de nom.
 */
export function AdminSearchInput({ value, onChange, placeholder, label, maxWidth = 320, compact = false }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  maxWidth?: number
  /** Filtre logé dans une barre de titre : plus bas, et libre de rétrécir. */
  compact?: boolean
}) {
  const { sp, surf } = useAdminSugar()
  const height = compact ? 30 : 36
  return (
    <div style={{ position: 'relative', flex: `1 1 ${compact ? 140 : 220}px`, minWidth: compact ? 130 : 200, maxWidth }}>
      <span
        aria-hidden="true"
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center' }}
      >
        <AdminIc icon={Search} size={compact ? 14 : 15} color={sp.sub} />
      </span>
      <input
        type="text"
        className="adm-search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', height, padding: `0 12px 0 ${compact ? 31 : 35}px`, boxSizing: 'border-box',
          borderRadius: ADMIN_RADII.row, border: 0, background: surf.cardSub,
          color: sp.ink, fontFamily: 'inherit', fontSize: compact ? 'var(--crm-text-sm)' : 'var(--crm-text-md)', fontWeight: 600,
          outline: 'none', transition: 'box-shadow .16s ease',
        }}
      />
    </div>
  )
}

/**
 * Pagination numérotée d'une liste paginée côté client.
 *
 * Recopiée dans cinq écrans, avec à chaque fois la même fenêtre glissante
 * (page courante ± 2, plus la première et la dernière, ellipses comprises).
 *
 * Ne s'affiche pas s'il n'y a qu'une page : la barre n'apprend alors rien.
 */
export function AdminPager({ page, totalPages, total, perPage, onPage }: {
  page: number
  totalPages: number
  total: number
  perPage: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation('admin')
  const { sp, surf } = useAdminSugar()
  if (totalPages <= 1) return null

  const btn: CSSProperties = {
    width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0,
  }
  // Fenêtre glissante : les pages proches, plus les deux extrémités.
  const shown = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)',
      padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderTop: surf.hairline,
    }}>
      <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} {t('common.on')} {total}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={t('common.previousPage')}
          style={{ ...btn, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
        >
          <AdminIc icon={ChevronLeft} size={15} color={sp.soft} />
        </button>
        {shown.map((p, idx, arr) => {
          const prev = arr[idx - 1]
          const on = p === page
          return (
            <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
              {prev !== undefined && p - prev > 1 && (
                <span style={{ padding: '0 var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>...</span>
              )}
              <button
                onClick={() => onPage(p)}
                aria-current={on ? 'page' : undefined}
                style={{
                  minWidth: 28, height: 28, padding: '0 var(--crm-space-md)', borderRadius: ADMIN_RADII.pill,
                  border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
                  fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  background: on ? sp.accent : 'transparent',
                  color: on ? sp.accentInk : sp.soft,
                }}
              >
                {p}
              </button>
            </span>
          )
        })}
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label={t('common.nextPage')}
          style={{ ...btn, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}
        >
          <AdminIc icon={ChevronRight} size={15} color={sp.soft} />
        </button>
      </div>
    </div>
  )
}

/**
 * Pilule d'un groupe segmenté — filtre, onglet ou sélection multiple.
 *
 * Neuf endroits redessinaient la même pilule : même hauteur, même rayon, même
 * bascule « accent plein quand retenue, effacée sinon ». Seul le COMPORTEMENT
 * diffère vraiment d'un site à l'autre (mono-sélection ici, bascule multiple
 * là, sentinelle « autre » ailleurs) — c'est donc le style qui est factorisé,
 * pas la logique : chaque appelant garde son état.
 *
 * `variant` distingue les trois rendus observés, et il faut choisir celui du
 * site remplacé plutôt que celui que son rôle suggère :
 *   - `filter` s'efface dans une barre d'outils (transparent au repos) ;
 *   - `tab` se pose sur la page, surface de carte et ombre pour rester lisible
 *     hors bento ;
 *   - `hollow` creuse la pastille dans le corps d'une modale — sur fond blanc,
 *     `filter` la ferait disparaître au repos.
 */
export function AdminSegmentBtn({ on, onClick, children, variant = 'filter', title }: {
  on: boolean
  onClick: () => void
  children: ReactNode
  variant?: 'filter' | 'tab' | 'hollow'
  title?: string
}) {
  const { sp, surf } = useAdminSugar()
  const tab = variant === 'tab'
  const restBg = tab ? surf.card : variant === 'hollow' ? surf.cardSub : 'transparent'
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      title={title}
      style={{
        height: tab ? 34 : 32, padding: tab ? '0 15px' : '0 14px',
        borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
        background: on ? sp.accent : restBg,
        color: on ? sp.accentInk : sp.soft,
        boxShadow: !on && tab ? sp.shadowSm : 'none',
      }}
    >
      {children}
    </button>
  )
}
