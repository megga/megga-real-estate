/**
 * Atomes du fil de matchs — l'avatar, la vignette d'un bien, le score, la baisse d'un prix, le bouton d'un geste et le
 * survol des lignes, partagés par les listes et les panneaux : un même acheteur, un même score ou un même geste ne se
 * dessinent jamais de deux façons sur un écran.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { PalierScore } from './filModele'
import { teinteScore, unSeulClic } from './filAffichage'

/** Initiales sur la sous-surface, neutres : une couleur d'avatar n'encode rien ici. */
export function FilAvatar({ sp, texte, taille }: { sp: CrmPalette; texte: string; taille: number }) {
  // Hors de la déclaration de style : le cliquet de grammaire lirait ce seuil comme une taille de texte.
  const texteGrand = taille >= 36
  return (
    <span aria-hidden style={{
      width: taille, height: taille, flex: 'none', display: 'grid', placeItems: 'center',
      borderRadius: 'var(--crm-radius-pill)', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
      color: sp.ink, fontSize: texteGrand ? 'var(--crm-text-md)' : 'var(--crm-text-xs)', fontWeight: 600,
    }}>
      {texte}
    </span>
  )
}

/**
 * La première photo d'un bien, ou une maison en sourdine.
 *
 * `no-referrer` : Flatfox refuse les images demandées depuis un autre site (même règle que `MrhPhoto`).
 */
export function FilVignette({ sp, photo, largeur, hauteur }: { sp: CrmPalette; photo: string | null; largeur: number; hauteur: number }) {
  return (
    <span aria-hidden style={{
      width: largeur, height: hauteur, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
      borderRadius: 'var(--crm-radius-xs)', background: sp.cardSubBg,
    }}>
      {photo
        ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <MEIcon name="home" size={14} color={sp.sub} />}
    </span>
  )
}

/** Le score : le chiffre à l'encre, le palier dans la pastille. Toujours une estimation (CLAUDE.md §5). */
export function FilScore({ sp, score, palier, grand = false }: { sp: CrmPalette; score: number; palier: PalierScore; grand?: boolean }) {
  const { t } = useTranslation('matching')
  const libelle = t('fil.scoreAria', { score, palier: t(`fil.palier.${palier}`) })
  return (
    <span title={libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', flex: 'none' }}>
      <span aria-hidden style={{ width: grand ? 10 : 8, height: grand ? 10 : 8, borderRadius: 'var(--crm-radius-pill)', background: teinteScore(palier, sp) }} />
      <span aria-hidden style={{ fontSize: grand ? 'var(--crm-text-6xl)' : 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
        {score}
      </span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}

/**
 * Une baisse de prix sur une ligne : la flèche et le montant, sans phrase (décision de Julien, 01.10.2026). La phrase
 * reste au survol et pour un lecteur d'écran (« Prix baissé de CHF 250'000 ») ; un panneau l'écrit en entier, datée.
 */
export function FilBaisse({ sp, montant }: { sp: CrmPalette; montant: string }) {
  const { t } = useTranslation('matching')
  const libelle = t('fil.signal.court', { montant })
  return (
    <span title={libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flex: 'none', whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name="arrow-down" size={12} color={sp.sub} /></span>
      <span aria-hidden>{montant}</span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}

/**
 * Le bouton d'un geste, sa touche ÉCRITE dessus (jamais cachée) : le principal porte l'accent (CLAUDE.md §3),
 * les autres un filet. `bien` pose `data-bien` : le fil y rend le focus après un geste annulé.
 *
 * ⛔ Un double clic trie DEUX lignes : le premier clic fait passer la sélection à la suivante (même bouton,
 * sous le curseur), le second la trie à son tour. D'où la garde du fil (`unSeulClic`).
 */
export function FilBouton({ sp, touche, onClick, principal = false, compact = false, bien, ouvert, desactive = false, children }: {
  sp: CrmPalette; touche?: string; onClick: () => void; principal?: boolean; compact?: boolean
  bien?: string; ouvert?: boolean; desactive?: boolean; children: ReactNode
}) {
  const { t } = useTranslation('matching')
  return (
    <button type="button" onClick={unSeulClic(onClick)} disabled={desactive} data-bien={bien} aria-expanded={ouvert}
      title={touche ? t('fil.actions.raccourci', { touche }) : undefined} aria-keyshortcuts={touche} style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: compact ? 32 : 40,
        paddingLeft: compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)',
        paddingRight: compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-pill)', border: principal ? 0 : `1px solid ${sp.cardBorder}`,
        cursor: desactive ? 'not-allowed' : 'pointer', opacity: desactive ? 0.5 : 1, fontFamily: 'inherit',
        background: principal ? sp.accent : 'transparent', color: principal ? sp.accentInk : sp.ink,
        fontSize: compact ? 'var(--crm-text-sm)' : 'var(--crm-text-md)', fontWeight: 600,
      }}>
      {children}
      {touche && <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: principal ? sp.accentInk : sp.sub }}>{touche}</kbd>}
    </button>
  )
}

/**
 * Le survol des lignes du fil (`.fil-ligne`), posé UNE fois par le conteneur : trois listes le partagent, et
 * celle qui le portait l'emportait quand on changeait d'onglet. `--fil-fond` suit le fond : l'anneau des
 * vignettes d'une ligne « Marché » en prend la teinte.
 */
export function FilStyleLignes({ sp }: { sp: CrmPalette }) {
  return <style>{`.fil-ligne:hover { background: ${sp.focusSurface} !important; --fil-fond: ${sp.focusSurface} !important; }`}</style>
}
