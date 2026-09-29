/**
 * Les listes d'« En attente » et d'« À conclure » (conception de la boucle, §5) : une ligne par ACHETEUR en
 * attente de réponse (ses biens proposés, sa relance), une ligne par bien qui INTÉRESSE un acheteur.
 *
 * ⚠ Mêmes lignes que « À proposer » (`styleLigne`, tabindex itinérant, `data-match` pour le focus) : c'est
 * `MatchingFil` qui porte le clavier. Une relance échue le dit, icône d'écart à l'appui ; un bien proposé
 * dont le prix a baissé depuis aussi (§4.6 : « sa ligne d'En attente porte le signal »).
 *
 * ⚠ Un mandat qui n'est plus en vente garde sa ligne d'« À conclure » (lot E1) : son état suit son titre.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, type FilMatch } from './filModele'
import { cleAttente, cleEtatMandat, type FilAttente } from './filBoucle'
import { dateCourte, styleLigne, teinteEcart, texteSignal, unSeulClic } from './filAffichage'
import { FilAvatar } from './filAtomes'

interface Props {
  sp: CrmPalette
  onglet: 'enAttente' | 'aConclure'
  attentes: FilAttente[]
  conclure: FilMatch[]
  courant: string | null
  onChoisir: (cle: string) => void
}

export default function FilListeBoucle({ sp, onglet, attentes, conclure, courant, onChoisir }: Props) {
  const { t } = useTranslation('matching')
  return (
    <div style={{ padding: 'var(--crm-space-lg)' }}>
      <div role="listbox" aria-label={t(onglet === 'enAttente' ? 'fil.attente.listeAria' : 'fil.conclure.listeAria')}>
        {onglet === 'enAttente'
          ? attentes.map((a) => (
            <LigneAttente key={a.acheteur.id} sp={sp} a={a} active={cleAttente(a.acheteur.id) === courant} onChoisir={onChoisir} />
          ))
          : conclure.map((m) => <LigneConclure key={m.id} sp={sp} m={m} active={m.id === courant} onChoisir={onChoisir} />)}
      </div>
    </div>
  )
}

function LigneAttente({ sp, a, active, onChoisir }: { sp: CrmPalette; a: FilAttente; active: boolean; onChoisir: (cle: string) => void }) {
  const { t } = useTranslation('matching')
  const cle = cleAttente(a.acheteur.id)
  const baisse = a.matchs.map((m) => texteSignal(m, t, true)).find((s) => s != null) ?? null
  const resume = [
    t('fil.attente.ligne', { count: a.matchs.length }),
    a.echeance ? t(a.due ? 'fil.attente.relanceDue' : 'fil.attente.relance', { date: dateCourte(a.echeance) }) : null,
    baisse,
  ].filter(Boolean).join(' · ')
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      className="fil-ligne" onClick={unSeulClic(() => onChoisir(cle))} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(a.acheteur.prenom, a.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.acheteur.prenom} {a.acheteur.nom}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {a.due && (
            <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
              <MEIcon name="alert" size={12} color={teinteEcart(sp)} />
            </span>
          )}
          {resume}
        </span>
      </span>
    </button>
  )
}

function LigneConclure({ sp, m, active, onChoisir }: { sp: CrmPalette; m: FilMatch; active: boolean; onChoisir: (cle: string) => void }) {
  const { t } = useTranslation('matching')
  const repondu = m.suivi?.reponduLe
  const etat = cleEtatMandat(m.bien)
  const titre = [m.bien.titre, etat ? t(etat) : null].filter(Boolean).join(' · ')
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={m.id}
      className="fil-ligne" onClick={unSeulClic(() => onChoisir(m.id))} onFocus={() => onChoisir(m.id)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.acheteur.prenom} {m.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {repondu ? t('fil.conclure.ligne', { titre, date: dateCourte(repondu) }) : titre}
        </span>
      </span>
    </button>
  )
}
