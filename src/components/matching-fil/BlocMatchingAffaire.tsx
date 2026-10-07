/**
 * Le bloc « Matching » de la fiche d'affaire (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md` §4) :
 * les biens de l'acheteur, un par ligne — le titre, son état en petit, le prix, le score. Une ligne mène au bien, à sa
 * place dans le fil ; une ligne sans place (une visite planifiée, un revenu reporté) ne mène nulle part.
 * Présentationnel : la fiche lit (`useMatchingAffaire`) et porte la section, son titre et « Ouvrir le matching ».
 *
 * ⚠ L'état s'écrit comme dans « Qui pour ce bien ? » (`texteEtatCompatible`) : une ligne de texte, pas une pastille.
 * ⚠ Aucun littéral de rayon, d'espacement ni de taille de texte : le cliquet de `megga-x-grammar.spec.ts` n'en tolère
 * aucun dans `matching-fil`.
 * ⛔ Rien ne part vers l'acheteur : une ligne ouvre le fil, où l'agent agit.
 */
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import type { MatchingAffaire } from '@/hooks/useMatchingAffaire'
import { avecArrivee } from '@/lib/jetonArrivee'
import type { BienAffaire } from './filAffaire'
import { montant, texteEtatCompatible, unSeulClic } from './filAffichage'
import { FilBouton, FilScore } from './filAtomes'
import { palierScore } from './filModele'

/** Ce que le bloc lit de la lecture ; le reste — le total, que la fiche écrit dans son en-tête — ne le regarde pas. */
type LectureBloc = Pick<MatchingAffaire, 'lignes' | 'isLoading' | 'isError' | 'aDesDonnees' | 'refetch'>

export default function BlocMatchingAffaire({ sp, lecture }: { sp: CrmPalette; lecture: LectureBloc }) {
  const { t } = useTranslation('matching')
  const note: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-md)', color: sp.sub }

  // En lecture, ou en échec d'une PREMIÈRE lecture, la liste est INCONNUE, pas vide : ni « Aucun bien », ni une ligne
  // qui ressemble à un résultat. Un rafraîchissement en échec garde ses lignes (`aDesDonnees`), comme les surfaces sœurs.
  if (lecture.isLoading) return <p role="status" style={note}>{t('fil.affaire.chargement')}</p>
  if (lecture.isError && !lecture.aDesDonnees) {
    // L'alerte ne dit que le message ; le geste est celui de « Qui pour ce bien ? » (`FilBouton compact`).
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
        <p role="alert" style={note}>{t('fil.affaire.erreur')}</p>
        <FilBouton sp={sp} compact onClick={() => { void lecture.refetch() }}>{t('fil.reessayer')}</FilBouton>
      </div>
    )
  }
  if (lecture.lignes.length === 0) return <p style={note}>{t('fil.affaire.aucun')}</p>

  return (
    // Un repère de position : chaque `FilScore` porte un texte `sr-only` en position absolue, qui se rangerait sinon
    // contre le premier ancêtre positionné — le pager de la fiche — et en allongerait le défilement.
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <style>{`.affaire-bien:hover { background: ${sp.focusSurface} !important; }`}</style>
      {lecture.lignes.map((b, i) => <LigneBien key={b.id} sp={sp} b={b} premiere={i === 0} />)}
    </div>
  )
}

/** Un bien : un bouton vers sa place dans le fil, ou, sans place, un simple bloc — ni rôle, ni focus, ni curseur. */
function LigneBien({ sp, b, premiere }: { sp: CrmPalette; b: BienAffaire; premiere: boolean }) {
  const { t } = useTranslation('matching')
  const navigate = useNavigate()
  // Deux boîtes. Le CADRE déborde de 2xs de chaque côté (une marge négative sous une marge intérieure égale) : le fond
  // du survol respire, et le texte s'aligne sur les listes voisines de la fiche. Le FILET vit sur la boîte intérieure,
  // à la largeur du contenu, comme ceux des lignes « Visites ». Les quatre côtés du cadre un à un : un `<button>` porte
  // une bordure d'agent utilisateur.
  const cadre: CSSProperties = {
    display: 'block', margin: '0 calc(-1 * var(--crm-space-2xs))', padding: '0 var(--crm-space-2xs)',
    borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: 0,
  }
  const contenu = (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) 0',
      borderTop: premiere ? 0 : `1px solid ${sp.cardBorder}`,
    }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{b.titre}</span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {texteEtatCompatible(b.etat, b.location, t)}{b.cleEtatMandat ? ` · ${t(b.cleEtatMandat)}` : ''}
        </span>
      </span>
      {/* Un prix inconnu ne s'écrit pas (règle n° 1) : le fil dit « Non renseigné », la ligne se tait. */}
      {b.prix != null && (
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {montant(b.location, b.prix, t)}
        </span>
      )}
      <FilScore sp={sp} score={b.score} palier={palierScore(b.score)} />
    </span>
  )
  const lien = b.lien
  if (!lien) return <div style={cadre}>{contenu}</div>
  // `unSeulClic` : sous `v7_startTransition`, la ligne reste là le temps de la navigation, et un double clic en
  // ferait deux — deux entrées d'historique.
  return (
    <button type="button" className="affaire-bien" onClick={unSeulClic(() => navigate(`/dashboard/matching?${lien}`, avecArrivee()))}
      style={{ ...cadre, width: 'calc(100% + 2 * var(--crm-space-2xs))', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
      {contenu}
    </button>
  )
}
