/**
 * « Apprendre » (conception de la boucle, §4.6) : au deuxième refus pour un même motif, la correction
 * CHIFFRÉE de la recherche de l'acheteur. L'agent la valide en un geste, la modifie d'abord (budget,
 * surface, pièces : un nombre pré-rempli), ou l'ignore.
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
import type { CrmPalette } from '@/components/crm/tokens'
import { formatCHF } from '@/lib/utils'
import { cleEquipement, initiales, lignesCriteres } from './filModele'
import {
  estNumerique, saisieRefusee, type ChangementNumerique, type Correction, type CorrectionChangement, type SaisieRefusee,
} from './filApprendre'
import { dateCourte, MARGE_POINTS, montant, teinteEcart } from './filAffichage'
import { FilAvatar, FilBouton, FilVignette } from './filAtomes'
import { resumeRecherche } from './filValeurs'

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
  // Pré-rempli comme on le lit : « 1'550'000 » (l'apostrophe de `formatCHF`, sans l'unité), « 4.5 ».
  const [saisie, setSaisie] = useState(() => (!estNumerique(ch) ? ''
    : ch.cle === 'rooms_min' ? String(ch.apres) : formatCHF(ch.apres).replace(/^CHF /, '')))
  // « 1'550'000 », « 1 550 000 » ou « 4,5 » se lisent : l'agent tape comme il lit.
  const valeur = Number(saisie.replace(/['’\s]/g, '').replace(',', '.'))
  const erreurSaisie = estNumerique(ch) ? saisieRefusee(c.criteres, ch, valeur) : null
  const valide = erreurSaisie == null
  const changement: CorrectionChangement = estNumerique(ch) && valide ? { ...ch, apres: valeur } : ch
  const { acheteur } = c
  const reference = c.refus[0]
  const nomType = (type: string): string => t(`fil.types.${type}`, { defaultValue: type })
  // Même libellé que la grille « Recherché / Ce bien » (`valeursCritere`) : sans le préfixe `custom:`.
  const nomEquipement = (f: string): string =>
    t(`fil.equipementsNoms.${cleEquipement(f)}`, { defaultValue: f.replace(/^custom:/i, '') })
  const avant = (n: ChangementNumerique): string => {
    const v = n.avant
    if (v == null) return t(n.cle === 'budget_max' ? 'fil.corrections.sansMax' : 'fil.corrections.sansMin')
    const valeur = n.cle === 'budget_max' ? montant(n.location, v, t)
      : n.cle === 'surface_min' ? t('fil.valeurs.m2', { valeur: nombre(v) })
        : nombre(v)
    return t('fil.corrections.avant', { valeur })
  }
  // La borne dite dans l'unité de la saisie : un montant, des m², des pièces.
  const refusLisible = (n: ChangementNumerique, r: SaisieRefusee): string => {
    if (r.raison === 'nombre') return t('fil.corrections.valeurInvalide')
    const borne = n.cle === 'budget_max' ? montant(n.location, r.borne, t)
      : n.cle === 'surface_min' ? t('fil.valeurs.m2', { valeur: nombre(r.borne) })
        : nombre(r.borne)
    return t(r.raison === 'sousMinimum' ? 'fil.corrections.sousMinimum' : 'fil.corrections.auDelaMaximum', { valeur: borne })
  }
  const lien: CSSProperties = { border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600 }
  const titre: CSSProperties = { margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }
  const texte: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-md)', color: sp.ink }
  const aide: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }
  return (
    <section aria-label={t('fil.corrections.titreAria', { nom: `${acheteur.prenom} ${acheteur.nom}` })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
              {t('fil.corrections.sousTitre', { count: c.refus.length, motif: t(`fil.motifs.${c.motif}`) })}
            </div>
          </div>
        </div>
        {reference && lignesCriteres(reference).length > 0 && (
          <p style={aide}>{t('fil.selection.recherche', { resume: resumeRecherche(reference, t, nombre) })}</p>
        )}

        <div>
          <h3 style={titre}>{t('fil.corrections.pourquoi')}</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
            {c.refus.map((m) => {
              const prix = m.suivi?.prixPropose ?? m.bien.prix
              const refuse = m.suivi?.reponduLe
              const details = [
                prix != null ? montant(m.bien.location, prix, t) : null,
                m.bien.pieces != null ? t('fil.selection.pieces', { count: m.bien.pieces, valeur: nombre(m.bien.pieces) }) : null,
                m.bien.surface != null ? t('fil.valeurs.m2', { valeur: nombre(m.bien.surface) }) : null,
                m.bien.ville,
                refuse ? t('fil.corrections.refuseLe', { date: dateCourte(refuse) }) : null,
              ].filter(Boolean).join(' · ')
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
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          <h3 style={titre}>{t('fil.corrections.proposition')}</h3>
          {estNumerique(ch) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
              <label htmlFor={champId} style={texte}>
                {t(ch.cle === 'budget_max' ? 'fil.corrections.budget' : ch.cle === 'surface_min' ? 'fil.corrections.surface' : 'fil.corrections.pieces')}
              </label>
              <input id={champId} inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)}
                aria-invalid={!valide} aria-describedby={aideId} style={{
                  width: 200, height: 36, border: `1px solid ${valide ? sp.cardBorder : teinteEcart(sp)}`,
                  borderRadius: 'var(--crm-radius-md)', background: sp.cardBg, color: sp.ink, fontFamily: 'inherit',
                  fontSize: 'var(--crm-text-md)', paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
                }} />
              <span id={aideId} style={aide}>{erreurSaisie ? refusLisible(ch, erreurSaisie) : avant(ch)}</span>
            </div>
          ) : ch.cle === 'zones' ? (
            <>
              <p style={texte}>{t('fil.corrections.zones', { liste: ch.retirees.join(', ') })}</p>
              <p style={aide}>{t('fil.corrections.zonesApres', { liste: ch.apres.join(', ') })}</p>
            </>
          ) : ch.cle === 'type' ? (
            <>
              <p style={texte}>{t('fil.corrections.type', { type: nomType(ch.apres) })}</p>
              <p style={aide}>{ch.avant ? t('fil.corrections.typeAvant', { type: nomType(ch.avant) }) : t('fil.corrections.tousTypes')}</p>
            </>
          ) : (
            <p style={texte}>{t('fil.corrections.equipements', { liste: ch.ajoutes.map(nomEquipement).join(', ') })}</p>
          )}
          <p style={aide}>{t('fil.corrections.effet')}</p>
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
