/**
 * En-tête du fil de matchs : le titre, le compte d'« À traiter », et les filtres Bien, Acheteur et
 * texte (§3.4). Ils remplacent les deux vues de l'atelier.
 *
 * ⚠ Des `<select>` NATIFS : deux filtres à choix unique n'ont besoin ni de recherche ni de groupes,
 * et le natif est accessible et navigable au clavier d'office. `colorScheme` suit le thème, sinon
 * la liste déroulante s'ouvrirait claire sur un écran sombre.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { FilFiltres, OptionFiltre } from './filModele'
import { encreAccent } from './filAffichage'

interface Props {
  sp: CrmPalette
  /** `null` tant que le compte n'est pas connu (chargement, échec). */
  compte: number | null
  filtres: FilFiltres
  options: { biens: OptionFiltre[]; acheteurs: OptionFiltre[] }
  onFiltres: (f: FilFiltres) => void
}

export default function FilEnTete({ sp, compte, filtres, options, onFiltres }: Props) {
  const { t } = useTranslation('matching')
  const champ: CSSProperties = {
    height: 34, borderRadius: 'var(--crm-radius-pill)', background: sp.cardBg, color: sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', colorScheme: sp.isDark ? 'dark' : 'light',
  }
  return (
    <header style={{
      display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--crm-space-lg)',
      padding: 'var(--crm-space-6xl) var(--crm-space-6xl) var(--crm-space-2xl)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, color: sp.ink }}>{t('fil.titre')}</h1>
        {compte != null && (
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {t('fil.aTraiter', { count: compte })}
          </p>
        )}
      </div>
      <Choix sp={sp} style={champ} libelle={t('fil.filtres.bien')} tous={t('fil.filtres.tousLesBiens')}
        valeur={filtres.bienId} options={options.biens} onChange={(bienId) => onFiltres({ ...filtres, bienId })} />
      <Choix sp={sp} style={champ} libelle={t('fil.filtres.acheteur')} tous={t('fil.filtres.tousLesAcheteurs')}
        valeur={filtres.acheteurId} options={options.acheteurs} onChange={(acheteurId) => onFiltres({ ...filtres, acheteurId })} />
      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <span aria-hidden style={{ position: 'absolute', left: 'var(--crm-space-lg)', display: 'flex', pointerEvents: 'none' }}>
          <MEIcon name="search" size={14} color={sp.sub} />
        </span>
        <input type="search" value={filtres.texte} onChange={(e) => onFiltres({ ...filtres, texte: e.target.value })}
          placeholder={t('fil.filtres.recherche')} aria-label={t('fil.filtres.recherche')}
          style={{ ...champ, width: 240, border: `1px solid ${sp.cardBorder}`, paddingLeft: 'var(--crm-space-7xl)', paddingRight: 'var(--crm-space-lg)' }} />
      </label>
    </header>
  )
}

function Choix({ sp, style, libelle, tous, valeur, options, onChange }: {
  sp: CrmPalette; style: CSSProperties; libelle: string; tous: string
  valeur: string | null; options: OptionFiltre[]; onChange: (v: string | null) => void
}) {
  const { t } = useTranslation('matching')
  // ⚠ Un `valeur` qui ne figure plus dans `options` (bien vendu, acheteur dont l'unique match vient
  // d'être proposé) reste le filtre ACTIF (`MatchingFil` ne l'efface plus) : le select doit donc
  // continuer à le montrer sélectionné plutôt que de retomber en silence sur « Tous ».
  const connu = valeur != null && options.some((o) => o.id === valeur)
  return (
    <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span className="sr-only">{libelle}</span>
      <select value={valeur ?? ''} onChange={(e) => onChange(e.target.value || null)} style={{
        ...style, appearance: 'none', cursor: 'pointer', maxWidth: 220,
        // L'élément ACTIF porte l'accent (CLAUDE.md §3) : un filtre posé se voit. Filet lisible sur sombre.
        border: `1px solid ${valeur ? encreAccent(sp) : sp.cardBorder}`,
        paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)',
      }}>
        <option value="">{tous}</option>
        {valeur && !connu && <option value={valeur}>{t('fil.filtres.inconnu')}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}
      </select>
      <span aria-hidden style={{ position: 'absolute', right: 'var(--crm-space-md)', display: 'flex', pointerEvents: 'none' }}>
        <MEIcon name="chevron-down" size={14} color={sp.sub} />
      </span>
    </label>
  )
}
