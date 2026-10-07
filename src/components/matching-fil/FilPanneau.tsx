/**
 * Le panneau d'un match à proposer (conception du fil, §4), en CARTE FOCUS depuis le fil épuré (sa conception, §3,
 * 07.10.2026) : la photo en grand, le prix et le score posés dessus ; le titre du bien et le nom de l'acheteur en liens ;
 * les critères repliés en une ligne (« 4 critères sur 4 »), qui déplie la comparaison « Recherché / Ce bien » et ce
 * qu'on lui a déjà proposé ; trois gestes — Écarter et Plus tard réduits à leur icône, « Proposé » le principal.
 * ⛔ « Proposé » n'envoie rien à l'acheteur (21.09.2026) : il consigne ce que l'agent a fait lui-même.
 *
 * ⚠ Une baisse se lit en flèche sur la photo ; sa phrase (« Refusé par … à CHF … · baissé de CHF … depuis »,
 * `texteSignalMatch`) vit dans le dépli. Un bien nouveau sur le marché ou un mandat neuf porte la pastille « Nouveau ».
 *
 * ⚠ Le dépli retient le match qu'il a ouvert : il se lit replié au match suivant, que le panneau soit remonté ou non —
 * `MatchingFil` le remonte à chaque ligne (la clé de son conteneur) ; ce composant n'en dépend pas.
 *
 * ⛔ Jamais de points à l'écran : le moteur reporte le poids d'un axe sans critère sur les autres, donc
 * la somme des points ne retombe pas sur le score, et l'afficher se lirait comme une erreur de calcul.
 */
import { useId, useState, type CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, lignesCriteres, palierScore, type FilMatch, type Historique, type LigneCritere } from './filModele'
import {
  baisseDuBien, baisseDuMatch, MARGE_POINTS, prixBien, teinteEcart, teinteTenu, texteSignalBien, texteSignalMatch,
} from './filAffichage'
import { signalBien } from './filSignaux'
import { FilAvatar, FilBaisse, FilBouton, FilNouveau, FilScore } from './filAtomes'
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
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const depliId = useId()
  const [ouvertPour, setOuvertPour] = useState<string | null>(null)
  const ouvert = ouvertPour === m.id
  const signal = signalBien(bien, maintenant)
  // La baisse depuis la proposition à CET acheteur d'abord (lot B), sinon celle de l'annonce (lot C).
  const baisse = baisseDuMatch(m, t) ?? (signal ? baisseDuBien(signal, bien, t) : null)
  // « Nouveau » cède à une baisse : la photo ne porte qu'un signal (une annonce en baisse a toujours sa flèche).
  const nouveau = signal && !baisse ? texteSignalBien(signal, bien, t, true) : null
  const phrase = texteSignalMatch(m, t, maintenant)
  const tenus = lignes.filter((l) => l.ok === true).length
  // La ligne des critères : l'alerte dès un écart, la coche quand TOUS tiennent — et rien quand l'un n'a pas été évalué
  // sans qu'aucun soit en écart : ni coche (tout n'est pas tenu), ni alerte (rien n'est en écart).
  const verdict = lignes.some((l) => l.ok === false) ? false : lignes.length > 0 && tenus === lignes.length ? true : null
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontWeight: 600, color: sp.ink,
  }
  const pastille: CSSProperties = {
    position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
    padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: sp.cardBg,
    border: `1px solid ${sp.cardBorder}`, color: sp.ink, fontSize: 'var(--crm-text-md)', fontWeight: 600,
  }
  return (
    <section aria-label={t('fil.panneauAria', { acheteur: `${acheteur.prenom} ${acheteur.nom}`, bien: bien.titre })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)` }}>
        <div style={{ position: 'relative', height: 280, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }}>
          {bien.photo
            // `no-referrer` : Flatfox refuse une image demandée depuis un autre site (même règle que `FilVignette`).
            ? <img src={bien.photo} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                <MEIcon name="home" size={18} color={sp.sub} />{t('fil.sansPhoto')}
              </span>
            )}
          {nouveau && <FilNouveau sp={sp} libelle={nouveau} style={{ ...pastille, top: 'var(--crm-space-md)', left: 'var(--crm-space-md)' }} />}
          <span style={{ ...pastille, bottom: 'var(--crm-space-md)', left: 'var(--crm-space-md)' }}>
            {prixBien(bien, t)}
            {baisse && <FilBaisse sp={sp} montant={baisse} />}
          </span>
          <span style={{ ...pastille, bottom: 'var(--crm-space-md)', right: 'var(--crm-space-md)' }}>
            <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
          </span>
        </div>

        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>
          <button type="button" onClick={onVoirBien} style={{ ...lien, fontSize: 'inherit' }}>{bien.titre}</button>
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-lg)' }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          <span role="img" aria-label={t(`fil.kyc.${acheteur.kyc}`)} title={t(`fil.kyc.${acheteur.kyc}`)} style={{ display: 'inline-flex' }}>
            {/* La coche n'appartient qu'au KYC vérifié : en clair, son vert et la sourdine ont la même luminance (1,02:1). */}
            {acheteur.kyc === 'verified'
              ? <MEIcon name="shield" size={16} color={teinteTenu(sp)} />
              : <MEIcon name="shield-plain" size={16} color={sp.sub} />}
          </span>
        </div>

        <div>
          {/* `aria-controls` ne vise le dépli que quand il existe : replié, il n'est pas rendu. */}
          <button type="button" aria-expanded={ouvert} aria-controls={ouvert ? depliId : undefined} onClick={() => setOuvertPour(ouvert ? null : m.id)}
            style={{ ...lien, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', fontWeight: 500 }}>
            {verdict !== null && <span aria-hidden style={{ display: 'inline-flex' }}><IconeVerdict sp={sp} ok={verdict} /></span>}
            {lignes.length === 0 ? t('fil.sansCriteres') : t('fil.criteresSur', { count: tenus, total: lignes.length })}
            {/* L'alerte est muette : « 4 critères sur 5 » ne dit pas, seul, si le cinquième est en écart ou non évalué. */}
            {verdict === false && <span className="sr-only">{` · ${t('fil.ecart')}`}</span>}
            <span aria-hidden style={{ display: 'inline-flex' }}>
              <MEIcon name={ouvert ? 'chevron-up' : 'chevron-down'} size={14} color={sp.sub} />
            </span>
          </button>
          {ouvert && (
            <div id={depliId} role="region" aria-label={t('fil.pourquoi')}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-md)' }}>
              {phrase && <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>{phrase}</p>}
              {lignes.length > 0 && <TableCriteres sp={sp} lignes={lignes} t={t} nombre={nombre} />}
              <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                {!historique || historique.proposes === 0
                  ? t('fil.historique.aucun', { prenom: acheteur.prenom })
                  : t('fil.historique.proposes', { prenom: acheteur.prenom, count: historique.proposes })
                    + (historique.interesses > 0 ? t('fil.historique.interesses', { count: historique.interesses }) : '')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`, background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} icone="close" libelle={t('fil.actions.ecarter')} touche="X" onClick={onEcarter} />
        <FilBouton sp={sp} icone="clock" libelle={t('fil.actions.plusTard')} touche="P" onClick={onPlusTard} />
        <span style={{ flex: 1 }} />
        <FilBouton sp={sp} touche="E" onClick={onProposer} principal libelle={t('fil.actions.proposer', { prenom: acheteur.prenom })}>
          {t('fil.actions.propose')}
        </FilBouton>
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
                    <IconeVerdict sp={sp} ok={l.ok} />
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

/** Un verdict : la coche d'un critère tenu, l'alerte d'un écart — la même dans la ligne des critères et dans le tableau. */
function IconeVerdict({ sp, ok }: { sp: CrmPalette; ok: boolean }) {
  return <MEIcon name={ok ? 'check' : 'alert'} size={16} color={ok ? teinteTenu(sp) : teinteEcart(sp)} />
}
