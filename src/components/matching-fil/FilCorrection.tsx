/**
 * « Apprendre » (conception de la boucle, §4.6) : au deuxième refus pour un même motif, la correction
 * CHIFFRÉE de la recherche de l'acheteur. L'agent la valide en un geste, la modifie d'abord (budget,
 * surface, pièces : un nombre pré-rempli), ou l'ignore.
 *
 * ⚠ Le fil épuré (07.10.2026) : le motif en pastille, les biens refusés à leur prix et leur date, la correction lue
 * AVANT → APRÈS — l'ancienne valeur barrée, la nouvelle dans son champ. L'ancienne est muette (`aria-hidden`) : un
 * lecteur d'écran l'entend « aujourd'hui : … », pour un nombre comme pour des quartiers ou un type — le barré, lui, ne
 * s'annonce pas partout, et sans lui « Champel, Genève, GE » ne dit plus ce qui part.
 *
 * ⚠ Valider renote les biens à proposer de CETTE recherche par le vrai moteur (`matching-engine`, mode
 * `rescore-search`) : ceux qui passent sous le seuil sortent du fil, écartés « recherche ajustée ». Pas de
 * fenêtre d'annulation — un bouton, jamais une touche. Seule la clé corrigée part (`onAjuster`) : le serveur
 * la fusionne dans les critères d'aujourd'hui, pas dans ceux que cet écran a lus.
 *
 * ⚠ Une saisie qui passerait sa borne (un budget maximum sous le minimum) est refusée, et l'écran dit
 * laquelle (`saisieRefusee`).
 *
 * ⚠ Les biens refusés sont montrés au prix où ils ont été PROPOSÉS : c'est à ce prix que l'acheteur a dit non.
 */
import { useId, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { formatCHF } from '@/lib/utils'
import { chaines, cleEquipement, initiales } from './filModele'
import {
  estNumerique, saisieRefusee, type ChangementNumerique, type Correction, type CorrectionChangement, type SaisieRefusee,
} from './filApprendre'
import { dateCourte, MARGE_POINTS, montant, teinteEcart } from './filAffichage'
import { FilAvatar, FilBouton, FilPastille, FilVignette } from './filAtomes'

interface Props {
  sp: CrmPalette
  correction: Correction
  /** La correction part : les deux gestes se grisent. */
  occupe: boolean
  /** La correction validée : sa seule clé, et la valeur saisie. */
  onAjuster: (changement: CorrectionChangement) => void
  onIgnorer: () => void
  onVoirContact: () => void
}

export default function FilCorrection({ sp, correction: c, occupe, onAjuster, onIgnorer, onVoirContact }: Props) {
  const { t, i18n } = useTranslation('matching')
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const champId = useId()
  const aideId = useId()
  const ch = c.changement
  // Pré-rempli comme on lit la valeur barrée à côté : « 1'550'000 » (l'apostrophe de `formatCHF`, sans l'unité), « 4,5 ».
  const [saisie, setSaisie] = useState(() => (!estNumerique(ch) ? ''
    : ch.cle === 'rooms_min' ? nombre(ch.apres) : formatCHF(ch.apres).replace(/^CHF /, '')))
  // « 1'550'000 », « 1 550 000 » ou « 4,5 » se lisent : l'agent tape comme il lit.
  const valeur = Number(saisie.replace(/['’\s]/g, '').replace(',', '.'))
  const erreurSaisie = estNumerique(ch) ? saisieRefusee(c.criteres, ch, valeur) : null
  const valide = erreurSaisie == null
  const changement: CorrectionChangement = estNumerique(ch) && valide ? { ...ch, apres: valeur } : ch
  const { acheteur } = c
  const nomType = (type: string): string => t(`fil.types.${type}`, { defaultValue: type })
  // Même libellé que la grille « Recherché / Ce bien » (`valeursCritere`) : sans le préfixe `custom:`.
  const nomEquipement = (f: string): string =>
    t(`fil.equipementsNoms.${cleEquipement(f)}`, { defaultValue: f.replace(/^custom:/i, '') })
  // Une valeur dans l'unité de la saisie : un montant, des m², des pièces.
  const enUnite = (n: ChangementNumerique, v: number): string => (n.cle === 'budget_max' ? montant(n.location, v, t)
    : n.cle === 'surface_min' ? t('fil.valeurs.m2', { valeur: nombre(v) }) : nombre(v))
  // La valeur d'aujourd'hui, barrée devant la saisie, ou l'absence de borne.
  const valeurAvant = (n: ChangementNumerique): string => (n.avant == null
    ? t(n.cle === 'budget_max' ? 'fil.corrections.sansMaxCourt' : 'fil.corrections.sansMinCourt') : enUnite(n, n.avant))
  // La même, dite à un lecteur d'écran : « aujourd'hui : CHF 1'600'000 ».
  const avant = (n: ChangementNumerique): string => (n.avant == null
    ? t(n.cle === 'budget_max' ? 'fil.corrections.sansMax' : 'fil.corrections.sansMin')
    : t('fil.corrections.avant', { valeur: enUnite(n, n.avant) }))
  // Pourquoi la saisie est refusée : un nombre illisible, ou la borne qu'elle passe.
  const refusLisible = (n: ChangementNumerique, r: SaisieRefusee): string => (r.raison === 'nombre'
    ? t('fil.corrections.valeurInvalide')
    : t(r.raison === 'sousMinimum' ? 'fil.corrections.sousMinimum' : 'fil.corrections.auDelaMaximum', { valeur: enUnite(n, r.borne) }))
  const typeOuTous = (type: string | null): string => (type ? nomType(type) : t('fil.corrections.tousTypes'))
  const lien: CSSProperties = { border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600 }
  const libelle: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }
  const texte: CSSProperties = { fontSize: 'var(--crm-text-md)', color: sp.ink }
  const barre: CSSProperties = { fontSize: 'var(--crm-text-md)', color: sp.sub, textDecoration: 'line-through' }
  const ligne: CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }
  const fleche = <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name="arrow-right" size={14} color={sp.sub} /></span>
  return (
    <section aria-label={t('fil.corrections.titreAria', { nom: `${acheteur.prenom} ${acheteur.nom}` })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          <FilPastille sp={sp}>{t('fil.corrections.ligne', { motif: t(`fil.motifs.${c.motif}`), count: c.refus.length })}</FilPastille>
        </div>

        <ul aria-label={t('fil.corrections.pourquoi')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          {c.refus.map((m) => {
            const prix = m.suivi?.prixPropose ?? m.bien.prix
            const refuse = m.suivi?.reponduLe
            const details = [prix != null ? montant(m.bien.location, prix, t) : null, refuse ? dateCourte(refuse) : null].filter(Boolean).join(' · ')
            return (
              <li key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
                borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
              }}>
                <FilVignette sp={sp} photo={m.bien.photo} largeur={56} hauteur={42} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.bien.titre}
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
                  {m.suivi?.note && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontStyle: 'italic', color: sp.ink }}>{m.suivi.note}</span>}
                </span>
              </li>
            )
          })}
        </ul>

        <div role="group" aria-label={t('fil.corrections.proposition')} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          {estNumerique(ch) ? (
            <>
              <label htmlFor={champId} style={libelle}>
                {t(ch.cle === 'budget_max' ? 'fil.corrections.budget' : ch.cle === 'surface_min' ? 'fil.corrections.surface' : 'fil.corrections.pieces')}
              </label>
              <div style={ligne}>
                <span aria-hidden style={barre}>{valeurAvant(ch)}</span>
                {fleche}
                <input id={champId} inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)}
                  aria-invalid={!valide} aria-describedby={aideId} style={{
                    width: 200, height: 36, border: `1px solid ${valide ? sp.cardBorder : teinteEcart(sp)}`,
                    borderRadius: 'var(--crm-radius-md)', background: sp.cardBg, color: sp.ink, fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-md)', paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
                  }} />
              </div>
              {/* Valide, l'ancienne valeur se lit barrée : la phrase ne reste que pour un lecteur d'écran. */}
              <span id={aideId} className={erreurSaisie ? undefined : 'sr-only'} style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                {erreurSaisie ? refusLisible(ch, erreurSaisie) : avant(ch)}
              </span>
            </>
          ) : ch.cle === 'zones' ? (
            <>
              <p style={libelle}>{t('fil.corrections.zones')}</p>
              <div style={ligne}><s aria-hidden style={barre}>{ch.retirees.join(', ')}</s>{fleche}<span style={texte}>{ch.apres.join(', ')}</span></div>
              {/* L'écran barre ce qui part ; un lecteur d'écran entend les quartiers d'aujourd'hui, en entier. */}
              <span className="sr-only">{t('fil.corrections.avant', { valeur: chaines(c.criteres.zones).join(', ') })}</span>
            </>
          ) : ch.cle === 'type' ? (
            <>
              <p style={libelle}>{t('fil.corrections.type')}</p>
              <div style={ligne}>
                <s aria-hidden style={barre}>{typeOuTous(ch.avant)}</s>{fleche}<span style={texte}>{nomType(ch.apres)}</span>
              </div>
              <span className="sr-only">{t('fil.corrections.avant', { valeur: typeOuTous(ch.avant) })}</span>
            </>
          ) : (
            <>
              <p style={libelle}>{t('fil.corrections.equipements')}</p>
              <span style={texte}>+ {ch.ajoutes.map(nomEquipement).join(', ')}</span>
            </>
          )}
        </div>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`,
        background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} onClick={onIgnorer} desactive={occupe}>{t('fil.corrections.ignorer')}</FilBouton>
        <span style={{ flex: 1 }} />
        <FilBouton sp={sp} principal onClick={() => onAjuster(changement)} desactive={!valide || occupe}>
          {t('fil.corrections.valider')}
        </FilBouton>
      </div>
    </section>
  )
}
