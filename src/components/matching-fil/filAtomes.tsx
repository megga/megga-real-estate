/**
 * Atomes du fil de matchs — l'avatar, la vignette d'un bien, le score, la baisse d'un prix, le bouton d'un geste et le
 * survol des lignes, partagés par les listes et les panneaux : un même acheteur, un même score ou un même geste ne se
 * dessinent jamais de deux façons sur un écran.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
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
 * Les deux formes d'un bouton de geste. Écrit, son texte le nomme ; réduit à son icône, `libelle` seul le nomme : il y
 * est exigé, et un texte n'y serait pas rendu.
 */
type FormeFilBouton =
  | { icone?: undefined; libelle?: string; children: ReactNode }
  | { icone: MEIconName; libelle: string; children?: undefined }

/**
 * Le bouton d'un geste : le principal porte l'accent (CLAUDE.md §3), les autres un filet. Sa touche ne s'écrit plus sur
 * sa face (le fil épuré, 07.10.2026) : elle vit dans l'infobulle et dans `aria-keyshortcuts`. Réduit à son icône
 * (`icone`), il est rond et porte son `libelle` en `aria-label` ; sur un bouton écrit, le `libelle` ne nourrit que
 * l'infobulle (« Je l'ai proposé à Anastasia · E ») : son nom reste le texte qu'on voit, celui qu'une commande vocale
 * prononce. `bien` pose `data-bien` : le fil y rend le focus après un geste annulé.
 *
 * ⛔ Un double clic trie DEUX lignes : le premier clic fait passer la sélection à la suivante (même bouton,
 * sous le curseur), le second la trie à son tour. D'où la garde du fil (`unSeulClic`).
 */
export function FilBouton({
  sp, touche, onClick, principal = false, compact = false, bien, ouvert, desactive = false, icone, libelle, children,
}: {
  sp: CrmPalette; touche?: string; onClick: () => void; principal?: boolean; compact?: boolean
  bien?: string; ouvert?: boolean; desactive?: boolean
} & FormeFilBouton) {
  const { t } = useTranslation('matching')
  const infobulle = !touche ? libelle
    : libelle ? t('fil.actions.infobulle', { libelle, touche }) : t('fil.actions.raccourci', { touche })
  const hauteur = compact ? 32 : 40
  const marge = icone ? 0 : compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)'
  const encre = principal ? sp.accentInk : sp.ink
  return (
    <button type="button" onClick={unSeulClic(onClick)} disabled={desactive} data-bien={bien} aria-expanded={ouvert}
      aria-label={icone ? libelle : undefined} title={infobulle} aria-keyshortcuts={touche} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)',
        height: hauteur, width: icone ? hauteur : undefined, paddingLeft: marge, paddingRight: marge,
        // Rond, il ne rétrécit pas dans une rangée serrée : il deviendrait un ovale.
        flex: icone ? 'none' : undefined,
        borderRadius: 'var(--crm-radius-pill)', border: principal ? 0 : `1px solid ${sp.cardBorder}`,
        cursor: desactive ? 'not-allowed' : 'pointer', opacity: desactive ? 0.5 : 1, fontFamily: 'inherit',
        background: principal ? sp.accent : 'transparent', color: encre,
        fontSize: compact ? 'var(--crm-text-sm)' : 'var(--crm-text-md)', fontWeight: 600,
      }}>
      {icone ? <MEIcon name={icone} size={16} color={encre} /> : children}
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
