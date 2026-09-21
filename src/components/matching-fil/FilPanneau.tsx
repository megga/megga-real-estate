/**
 * Le panneau d'un match (§4) : le bien, l'acheteur, le score, la comparaison « Recherché / Ce bien »
 * et UN bouton principal.
 *
 * Lot 1 : l'étape « À traiter » seule — « Je l'ai proposé », Plus tard, Écarter. Les boutons des autres
 * étapes arrivent avec leurs onglets, au lot 3. ⛔ « Je l'ai proposé » n'envoie rien à l'acheteur
 * (21.09.2026) : il consigne ce que l'agent a fait lui-même.
 *
 * ⛔ Jamais de points à l'écran : le moteur reporte le poids d'un axe sans critère sur les autres, donc
 * la somme des points ne retombe pas sur le score, et l'afficher se lirait comme une erreur de calcul.
 */
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, lignesCriteres, palierScore, type FilMatch, type Historique, type LigneCritere } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, teinteEcart, teinteTenu } from './filAffichage'
import { FilAvatar, FilScore } from './filAtomes'
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
}

export default function FilPanneau({ sp, m, historique, onProposer, onPlusTard, onEcarter, onVoirBien, onVoirContact }: Props) {
  const { t, i18n } = useTranslation('matching')
  const { bien, acheteur } = m
  const lignes = lignesCriteres(m)
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
            <button type="button" onClick={onVoirBien} style={{ ...lien, marginTop: 'var(--crm-space-sm)' }}>{t('fil.voirBien')}</button>
          </div>
          <div style={{ flex: 'none', textAlign: 'right' }}>
            <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} grand />
            <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.estimation')}</div>
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
        <Bouton sp={sp} t={t} touche="X" onClick={onEcarter}>{t('fil.actions.ecarter')}</Bouton>
        <Bouton sp={sp} t={t} touche="P" onClick={onPlusTard}>{t('fil.actions.plusTard')}</Bouton>
        <span style={{ flex: 1 }} />
        <Bouton sp={sp} t={t} touche="E" onClick={onProposer} principal>{t('fil.actions.proposer', { prenom: acheteur.prenom })}</Bouton>
      </div>
    </section>
  )
}

function Bouton({ sp, t, touche, onClick, principal = false, children }: {
  sp: CrmPalette; t: TFunction; touche: string; onClick: () => void; principal?: boolean; children: ReactNode
}) {
  // ⛔ Un double clic trie DEUX matchs : le premier clic fait passer la sélection au suivant (même
  // bouton, sous le curseur), et le second clic du double clic le trie à son tour. `detail` compte
  // les clics du même geste (2 au second) ; l'activation clavier vaut toujours 0, donc elle reste intacte.
  const clic = (e: MouseEvent<HTMLButtonElement>) => { if (e.detail > 1) return; onClick() }
  return (
    <button type="button" onClick={clic} title={t('fil.actions.raccourci', { touche })} aria-keyshortcuts={touche} style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40,
      paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
      border: principal ? 0 : `1px solid ${sp.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit',
      background: principal ? sp.accent : 'transparent', color: principal ? sp.accentInk : sp.ink,
      fontSize: 'var(--crm-text-md)', fontWeight: 600,
    }}>
      {children}
      <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: principal ? sp.accentInk : sp.sub }}>{touche}</kbd>
    </button>
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
