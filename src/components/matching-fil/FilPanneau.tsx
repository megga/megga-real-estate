/**
 * Le panneau d'un match à proposer (§4) : le bien, l'acheteur, le score, la comparaison « Recherché / Ce
 * bien » et UN bouton principal — « Je l'ai proposé », Plus tard, Écarter. ⛔ « Je l'ai proposé » n'envoie
 * rien à l'acheteur (21.09.2026) : il consigne ce que l'agent a fait lui-même.
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B) le dit sous son prix : « Refusé par … à
 * CHF … · baissé de CHF … depuis » (`texteSignal`).
 *
 * ⛔ Jamais de points à l'écran : le moteur reporte le poids d'un axe sans critère sur les autres, donc
 * la somme des points ne retombe pas sur le score, et l'afficher se lirait comme une erreur de calcul.
 */
import type { CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, lignesCriteres, palierScore, type FilMatch, type Historique, type LigneCritere } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, teinteEcart, teinteTenu, texteSignalMatch } from './filAffichage'
import { FilAvatar, FilBouton, FilScore } from './filAtomes'
import { valeursCritere } from './filValeurs'

interface Props {
  sp: CrmPalette
  m: FilMatch
  historique: Historique | undefined
  onProposer: () => void
  onPlusTard: () => void
  onEcarter: () => void
  onVoirBien: () => void
  onVoirContact: () => void
  maintenant: number
}

export default function FilPanneau({ sp, m, historique, onProposer, onPlusTard, onEcarter, onVoirBien, onVoirContact, maintenant }: Props) {
  const { t, i18n } = useTranslation('matching')
  const { bien, acheteur } = m
  const lignes = lignesCriteres(m)
  const signal = texteSignalMatch(m, t, maintenant)
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
  }
  return (
    <section aria-label={t('fil.panneauAria', { acheteur: `${acheteur.prenom} ${acheteur.nom}`, bien: bien.titre })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)', padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)` }}>
        <div style={{ height: 220, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }}>
          {bien.photo
            ? <img src={bien.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                <MEIcon name="home" size={18} color={sp.sub} />{t('fil.sansPhoto')}
              </span>
            )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
            }}>
              {t('fil.votreBien')}
            </span>
            <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
              {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
            </p>
            {signal && (
              <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>{signal}</p>
            )}
            <button type="button" onClick={onVoirBien} style={{ ...lien, marginTop: 'var(--crm-space-sm)' }}>{t('fil.voirBien')}</button>
          </div>
          <div style={{ flex: 'none', textAlign: 'right' }}>
            <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} grand />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-lg)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: acheteur.kyc === 'verified' ? teinteTenu(sp) : sp.sub }}>
              {t(`fil.kyc.${acheteur.kyc}`)}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>
            {t('fil.pourquoi')}
          </h3>
          {lignes.length === 0
            ? <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('fil.sansCriteres')}</p>
            : <TableCriteres sp={sp} lignes={lignes} t={t} nombre={nombre} />}
        </div>

        <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
          {!historique || historique.proposes === 0
            ? t('fil.historique.aucun', { prenom: acheteur.prenom })
            : t('fil.historique.proposes', { prenom: acheteur.prenom, count: historique.proposes })
              + (historique.interesses > 0 ? t('fil.historique.interesses', { count: historique.interesses }) : '')}
        </p>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`, background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} touche="X" onClick={onEcarter}>{t('fil.actions.ecarter')}</FilBouton>
        <FilBouton sp={sp} touche="P" onClick={onPlusTard}>{t('fil.actions.plusTard')}</FilBouton>
        <span style={{ flex: 1 }} />
        <FilBouton sp={sp} touche="E" onClick={onProposer} principal>{t('fil.actions.proposer', { prenom: acheteur.prenom })}</FilBouton>
      </div>
    </section>
  )
}

function TableCriteres({ sp, lignes, t, nombre }: { sp: CrmPalette; lignes: LigneCritere[]; t: TFunction; nombre: (n: number) => string }) {
  const cellule: CSSProperties = {
    padding: 'var(--crm-space-sm) var(--crm-space-xs)', borderBottom: `1px solid ${sp.cardBorder}`, textAlign: 'left', verticalAlign: 'top',
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'var(--crm-text-md)', color: sp.ink }}>
      <thead>
        <tr style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          <th scope="col" style={{ ...cellule, width: '24%', fontWeight: 500 }}>{t('fil.colonnes.critere')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.recherche')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.bien')}</th>
          <th scope="col" style={{ ...cellule, width: 32 }}><span className="sr-only">{t('fil.colonnes.verdict')}</span></th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => {
          const [recherche, propose] = valeursCritere(l, t, nombre)
          return (
            <tr key={l.cle}>
              <th scope="row" style={{ ...cellule, fontWeight: 500, color: sp.sub }}>{t(`fil.criteres.${l.cle}`)}</th>
              <td style={cellule}>{recherche}</td>
              <td style={cellule}>
                {propose}
                {l.ecart && (
                  <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: teinteEcart(sp) }}>{l.ecart}</span>
                )}
              </td>
              <td style={cellule}>
                {l.ok !== null && (
                  <span role="img" aria-label={t(l.ok ? 'fil.correspond' : 'fil.ecart')} style={{ display: 'inline-flex' }}>
                    <MEIcon name={l.ok ? 'check' : 'alert'} size={16} color={l.ok ? teinteTenu(sp) : teinteEcart(sp)} />
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
