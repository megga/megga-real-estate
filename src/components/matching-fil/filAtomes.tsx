/**
 * Atomes du fil de matchs — l'avatar, la vignette d'un bien, le score, une donnée en icône (la baisse d'un prix, les
 * compteurs d'une ligne « Marché »), la pastille « Nouveau », celle d'un en-tête de panneau, le bouton d'un geste et le
 * survol des lignes, partagés par les listes et les panneaux : un même acheteur, un même score ou un même geste ne se
 * dessinent jamais de deux façons sur un écran.
 */
import type { CSSProperties, ReactNode } from 'react'
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
 * Une donnée en icône : l'icône et sa valeur à l'écran, son libellé au survol et pour un lecteur d'écran — la baisse
 * d'un prix (`FilBaisse`), les compteurs d'une ligne « Marché » (« ↓ 1 », « ⚡ 1 »). ⚠ `verticalAlign` la pose sur la
 * ligne d'un texte : sans lui, écrite après un texte, elle montait de 2 px ; dans une rangée flex, il est sans effet.
 */
export function FilCompteur({ sp, icone, valeur, libelle }: { sp: CrmPalette; icone: MEIconName; valeur: string | number; libelle: string }) {
  return (
    <span title={libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flex: 'none', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
      <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name={icone} size={12} color={sp.sub} /></span>
      <span aria-hidden>{valeur}</span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}

/**
 * Une baisse de prix sur une ligne ou sur la photo d'un panneau : la flèche et le montant, sans phrase (décision de
 * Julien, 01.10.2026). La phrase reste au survol et pour un lecteur d'écran (« Prix baissé de CHF 250'000 ») ; le dépli
 * d'un panneau l'écrit en entier, datée. Là où aucun dépli ne l'écrit (la sélection du marché), `libelle` porte cette
 * phrase entière — qui l'a refusé, à quel prix, depuis quand.
 */
export function FilBaisse({ sp, montant, libelle }: { sp: CrmPalette; montant: string; libelle?: string | null }) {
  const { t } = useTranslation('matching')
  return <FilCompteur sp={sp} icone="arrow-down" valeur={montant} libelle={libelle ?? t('fil.signal.court', { montant })} />
}

/**
 * Un bien neuf — un mandat, une annonce nouvelle sur le marché — en un mot : « Nouveau ». Son libellé (« Nouveau
 * mandat ») au survol et pour un lecteur d'écran, comme la flèche de `FilBaisse`. La pastille d'une ligne par défaut ;
 * `style` la remplace là où elle se pose ailleurs (sur la photo de la carte focus).
 */
export function FilNouveau({ sp, libelle, style }: { sp: CrmPalette; libelle: string; style?: CSSProperties }) {
  const { t } = useTranslation('matching')
  return (
    <span title={libelle} style={style ?? {
      flex: 'none', padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`,
      fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.ink,
    }}>
      <span aria-hidden>{t('fil.signal.pastille')}</span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}

/**
 * L'état d'un acheteur dans l'en-tête de son panneau, rangé à droite de son nom : le motif d'« À ajuster » (« Prix ·
 * 2 refus »), la « Relance » d'« En attente ». Une icône peut y porter la couleur (`teinte`) ; le texte reste à l'encre.
 * Quand le mot ne dit pas tout, `libelle` le dit au survol ET à un lecteur d'écran — « Relance », pour « relance due
 * depuis le 30.09 » —, comme `FilNouveau`, la pastille d'une LIGNE (plus petite : elle ne doit pas grandir sa ligne).
 */
export function FilPastille({ sp, icone, teinte, libelle, children }: {
  sp: CrmPalette; icone?: MEIconName; teinte?: string; libelle?: string; children: ReactNode
}) {
  return (
    <span title={libelle} style={{
      marginLeft: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)',
      padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
      border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-sm)', color: sp.ink,
    }}>
      {icone && <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name={icone} size={14} color={teinte ?? sp.sub} /></span>}
      {libelle ? <><span aria-hidden>{children}</span><span className="sr-only">{libelle}</span></> : children}
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
