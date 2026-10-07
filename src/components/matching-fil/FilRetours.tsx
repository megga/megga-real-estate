/**
 * « Retours de … » (conception de la boucle, §4.4) : les biens proposés à un acheteur et pas encore répondus,
 * toutes propositions confondues. Pour chacun, trois gestes : Intéressé (I), Pas intéressé (N, puis un motif
 * en une puce), Pas encore (P).
 *
 * ⚠ Les touches visent le bien qui porte le focus (`data-retour`), sinon le premier : c'est `MatchingFil` qui
 * les lit, comme tout le clavier du fil. « Intéressé » porte `data-bien` : le focus y revient après un geste
 * annulé.
 *
 * ⚠ « Pas encore » n'écrit rien sur le match : la relance de sa proposition est repoussée de trois jours.
 *
 * ⚠ Le titre est le NOM de l'acheteur, comme dans la sélection du marché — pas « Retours de Julie » : le
 * français élide devant une voyelle (« d'Emma »), et une interpolation ne le sait pas.
 *
 * ⚠ Un mandat qui n'est plus en vente garde sa place (lot E1) : son état s'écrit en tête du bien (« Vendu · CHF … »).
 *
 * ⚠ Le fil épuré (07.10.2026) : le nom seul, et la pastille « Relance » quand elle est due (sa date au survol et pour
 * un lecteur d'écran) ; un bien proposé à son prix d'AUJOURD'HUI et à la date de sa proposition, sa baisse depuis en
 * flèche.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, palierScore, type FilMatch } from './filModele'
import { cleEtatMandat, type FilAttente, type MotifRefus } from './filBoucle'
import { baisseDuMatch, dateCourte, encreAccent, MARGE_POINTS, prixBien, teinteEcart } from './filAffichage'
import { FilAvatar, FilBaisse, FilBouton, FilPastille, FilScore, FilVignette } from './filAtomes'
import FilMotifs from './FilMotifs'

interface Props {
  sp: CrmPalette
  attente: FilAttente
  /** Le bien dont on choisit le motif de refus, ou `null`. */
  motifsPour: string | null
  onInteresse: (m: FilMatch) => void
  onPasInteresse: (m: FilMatch) => void
  onMotif: (m: FilMatch, motif: MotifRefus, note: string | null) => void
  onFermerMotifs: () => void
  onPasEncore: (m: FilMatch) => void
  onVoirContact: () => void
}

export default function FilRetours({
  sp, attente, motifsPour, onInteresse, onPasInteresse, onMotif, onFermerMotifs, onPasEncore, onVoirContact,
}: Props) {
  const { t } = useTranslation('matching')
  const { acheteur, matchs, echeance, due } = attente
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600,
  }
  return (
    <section aria-label={t('fil.retours.titre', { nom: `${acheteur.prenom} ${acheteur.nom}` })} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
      padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
        <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
        <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
          {acheteur.prenom} {acheteur.nom}
        </button>
        {/* Une relance due se dit en pastille, sa date au survol et pour un lecteur d'écran ; à venir, la ligne de la liste
            la date déjà. */}
        {due && echeance && (
          <FilPastille sp={sp} icone="alert" teinte={teinteEcart(sp)} libelle={t('fil.attente.relanceDue', { date: dateCourte(echeance) })}>
            {t('fil.retours.relance')}
          </FilPastille>
        )}
      </div>
      <ul aria-label={t('fil.retours.listeAria', { prenom: acheteur.prenom })} style={{
        listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)',
      }}>
        {matchs.map((m) => {
          const ouvert = motifsPour === m.id
          return (
            <li key={m.id} data-retour={m.id} style={{
              display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
              borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg,
              // Le bien dont on choisit le motif est l'élément ACTIF : il porte l'accent (CLAUDE.md §3).
              border: `1px solid ${ouvert ? encreAccent(sp) : sp.cardBorder}`,
            }}>
              <BienPropose sp={sp} m={m} />
              <div role="group" aria-label={m.bien.titre} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
                <FilBouton sp={sp} compact principal touche="I" bien={m.id} onClick={() => onInteresse(m)}>{t('fil.retours.interesse')}</FilBouton>
                <FilBouton sp={sp} compact touche="N" ouvert={ouvert} onClick={() => onPasInteresse(m)}>{t('fil.retours.pasInteresse')}</FilBouton>
                <FilBouton sp={sp} compact touche="P" onClick={() => onPasEncore(m)}>{t('fil.retours.pasEncore')}</FilBouton>
              </div>
              {ouvert && <FilMotifs sp={sp} onChoisir={(motif, note) => onMotif(m, motif, note)} onAnnuler={onFermerMotifs} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function BienPropose({ sp, m }: { sp: CrmPalette; m: FilMatch }) {
  const { t } = useTranslation('matching')
  const baisse = baisseDuMatch(m, t)
  const propose = m.suivi?.proposeLe
  const etat = cleEtatMandat(m.bien)
  // Le prix d'AUJOURD'HUI, que suit la flèche (« CHF … · ↓ CHF … »), comme partout où le fil en pose une — « À ajuster »
  // montre, lui, le prix PROPOSÉ, celui auquel on a dit non. La date, celle de la proposition, sans « proposé le » :
  // l'onglet dit déjà ce qu'on attend.
  const details = [etat ? t(etat) : null, prixBien(m.bien, t), propose ? dateCourte(propose) : null].filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
      <FilVignette sp={sp} photo={m.bien.photo} largeur={56} hauteur={42} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.bien.titre}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {details}
          {baisse && <> · <FilBaisse sp={sp} montant={baisse} /></>}
        </span>
      </span>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
    </div>
  )
}
