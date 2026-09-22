/**
 * « Qui pour ce bien ? » (lot C, conception de la boucle §4.2) — le panneau de l'en-tête d'un bien en mandat.
 * (1) Les acquéreurs compatibles : ses matchs que le fil connaît, par score, avec leur état ; un match à proposer
 * s'ouvre en un clic. (2) Les anciens prospects, notés À LA DEMANDE par le moteur (`useAnciensProspects`) :
 * recherche close depuis plus de 90 jours, ou deal perdu ; « Réactiver » rouvre sa recherche et fait entrer le match
 * dans « À proposer ». Les prescripteurs attendent le modèle relationnel (étape 6) : pas de section vide.
 *
 * ⛔ Réactiver n'écrit rien à l'acheteur : c'est l'agent qui l'appellera (conception de la boucle, §1).
 *
 * ⚠ Les anciens prospects ne se demandent au moteur qu'après `DELAI_PROSPECTS` sur l'en-tête : parcourir le fil
 * aux flèches passe sur chaque en-tête, et chaque passage relirait les recherches closes de l'agence. Le panneau
 * est remonté à chaque ligne (`key` du conteneur, `MatchingFil`) : quitter l'en-tête avant le délai n'appelle rien.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAnciensProspects, type AncienProspect } from '@/hooks/useAnciensProspects'
import { initiales, palierScore, temps, type FilBien, type FilMatch } from './filModele'
import { dateCourte, dateLongue, encreAccent, MARGE_POINTS, prixBien, texteSignalBien } from './filAffichage'
import { signalBien } from './filSignaux'
import { FilAvatar, FilBouton, FilScore, FilVignette } from './filAtomes'

/** Le temps qu'un en-tête reste choisi avant qu'on note ses anciens prospects : au-delà, on s'y arrête. */
const DELAI_PROSPECTS = 400

interface Props {
  sp: CrmPalette
  bien: FilBien
  /** Ses matchs connus du fil : à proposer, reportés, et ceux de la boucle. */
  compatibles: FilMatch[]
  /** L'heure de la lecture du fil. */
  maintenant: number
  /** Le match est une ligne du fil telle qu'elle s'affiche (filtres compris) : « Ouvrir » ne mène qu'à ce qu'on voit. */
  peutOuvrir: (matchId: string) => boolean
  onChoisir: (matchId: string) => void
  onVoirBien: () => void
  onVoirContact: (contactId: string) => void
}

export default function FilQuiPourCeBien({ sp, bien, compatibles, maintenant, peutOuvrir, onChoisir, onVoirBien, onVoirContact }: Props) {
  const { t } = useTranslation('matching')
  const toast = useToast()
  const [pret, setPret] = useState(false)
  useEffect(() => {
    const minuterie = setTimeout(() => setPret(true), DELAI_PROSPECTS)
    return () => clearTimeout(minuterie)
  }, [bien.id])
  const prospects = useAnciensProspects(pret ? bien.id : null)
  const signal = signalBien(bien, maintenant)
  const tries = [...compatibles].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const anciens = prospects.data ?? []
  const reactiver = (p: AncienProspect): void => {
    // Pas de `desactive` sur le bouton : un bouton désactivé sous le focus le perd, et `reprendreFocus`
    // (`MatchingFil`) le renverrait à la liste. La garde est ici.
    if (prospects.reactiver.isPending) return
    prospects.reactiver.mutate(p, {
      onSuccess: () => { toast.success(t('fil.quiPour.reactive', { prenom: p.prenom })) },
      onError: () => { toast.error(t('fil.quiPour.erreurReactiver')) },
    })
  }
  const titre: CSSProperties = { margin: 0, marginBottom: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }
  const aide: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }
  const nom: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
  }
  const ligne: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-sm)',
    paddingBottom: 'var(--crm-space-sm)', borderBottom: `1px solid ${sp.cardBorder}`,
  }
  const liste: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }
  return (
    <section aria-label={t('fil.quiPour.titreAria', { titre: bien.titre })} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
      padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
        <FilVignette sp={sp} photo={bien.photo} largeur={96} hauteur={72} />
        <div style={{ minWidth: 0 }}>
          <span style={{
            display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
          }}>
            {t('fil.quiPour.titre')}
          </span>
          <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
          </p>
          {signal && (
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {texteSignalBien(signal, bien, t)}
            </p>
          )}
          <button type="button" onClick={onVoirBien} style={{ ...nom, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: encreAccent(sp) }}>
            {t('fil.voirBien')}
          </button>
        </div>
      </div>

      <div>
        <h3 style={titre}>{t('fil.quiPour.compatibles', { count: tries.length })}</h3>
        {tries.length === 0 ? <p style={aide}>{t('fil.quiPour.aucunCompatible')}</p> : (
          <ul style={liste}>
            {tries.map((m) => {
              const reporte = m.reporteJusquau != null && temps(m.reporteJusquau) > maintenant
              const ouvrable = peutOuvrir(m.id)
              return (
                <li key={m.id} style={ligne}>
                  <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <button type="button" onClick={() => onVoirContact(m.acheteur.id)} style={nom}>{m.acheteur.prenom} {m.acheteur.nom}</button>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{etatCompatible(m, reporte, t)}</span>
                  </span>
                  <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
                  {ouvrable && (
                    <FilBouton sp={sp} compact onClick={() => onChoisir(m.id)}>
                      {t('fil.quiPour.ouvrir')}<span className="sr-only"> {m.acheteur.prenom} {m.acheteur.nom}</span>
                    </FilBouton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 style={titre}>{t('fil.quiPour.anciens')}</h3>
        <p style={{ ...aide, marginBottom: 'var(--crm-space-md)' }}>{t('fil.quiPour.anciensAide')}</p>
        {!pret || prospects.isLoading ? <p role="status" style={aide}>{t('fil.quiPour.chargement')}</p>
          : prospects.isError ? (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
              <p style={aide}>{t('fil.quiPour.erreur')}</p>
              <FilBouton sp={sp} compact onClick={() => { void prospects.refetch() }}>{t('fil.reessayer')}</FilBouton>
            </div>
          ) : anciens.length === 0 ? <p style={aide}>{t('fil.quiPour.aucunAncien')}</p> : (
            <ul style={liste}>
              {anciens.map((p) => (
                <li key={p.contact_id} style={ligne}>
                  <FilAvatar sp={sp} texte={initiales(p.prenom, p.nom)} taille={28} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <button type="button" onClick={() => onVoirContact(p.contact_id)} style={nom}>{p.prenom} {p.nom}</button>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{origine(p, t)}</span>
                  </span>
                  <FilScore sp={sp} score={p.score} palier={palierScore(p.score)} />
                  <FilBouton sp={sp} compact principal onClick={() => reactiver(p)}>
                    {t('fil.quiPour.reactiver')}<span className="sr-only"> {p.prenom} {p.nom}</span>
                  </FilBouton>
                </li>
              ))}
            </ul>
          )}
      </div>
    </section>
  )
}

/** Où en est un acquéreur compatible, écrit. */
function etatCompatible(m: FilMatch, reporte: boolean, t: TFunction): string {
  if (reporte && m.reporteJusquau) return t('fil.quiPour.etat.reporte', { date: dateCourte(m.reporteJusquau) })
  const s = m.suivi
  if (!s || s.statut === 'suggested') return t('fil.quiPour.etat.aProposer')
  if (s.statut === 'sent') return s.proposeLe ? t('fil.quiPour.etat.propose', { date: dateCourte(s.proposeLe) }) : t('fil.quiPour.etat.proposeSansDate')
  if (s.statut === 'interested') return t('fil.quiPour.etat.interesse')
  if (s.statut === 'visit_planned') return t('fil.quiPour.etat.visite')
  return s.motif ? t('fil.quiPour.etat.refuse', { motif: t(`fil.motifs.${s.motif}`) }) : t('fil.quiPour.etat.refuseSansMotif')
}

/** Ce qui fait un ancien prospect, daté avec l'année : un deal perdu remonte jusqu'à 24 mois. */
function origine(p: AncienProspect, t: TFunction): string {
  if (p.origine === 'deal_perdu') return p.depuis ? t('fil.quiPour.dealPerdu', { date: dateLongue(p.depuis) }) : t('fil.quiPour.dealPerduSansDate')
  return p.depuis ? t('fil.quiPour.rechercheClose', { date: dateLongue(p.depuis) }) : t('fil.quiPour.rechercheCloseSansDate')
}
