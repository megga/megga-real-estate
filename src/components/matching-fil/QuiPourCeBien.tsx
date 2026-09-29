/**
 * « Qui pour ce bien ? » — les deux listes (lot C), partagées par le panneau du fil et les deux fiches (lot D1,
 * conception §7) : (1) les acquéreurs compatibles, par score, avec leur état ; (2) les anciens prospects d'un MANDAT
 * (recherche close depuis plus de 90 jours, ou deal perdu), notés à la demande par le moteur (`useAnciensProspects`) — une
 * annonce du marché n'en a pas : le moteur ne les note que contre un mandat. « Réactiver » rouvre sa recherche et fait
 * entrer le match dans « À proposer ». Ni l'en-tête du bien, ni la notion de ligne du fil : « Ouvrir » est ce que
 * l'appelant en fait (`ouvrir`) — choisir une ligne dans le fil, ou y mener depuis une fiche.
 * ⚠ La section des anciens prospects se demande EXPLICITEMENT (`avecAnciens`) : le moteur ne note qu'un mandat ACTIF
 * (`lireBien`, `matching-engine`) — sur un brouillon, un bien vendu ou archivé, l'appel partait pour un 404, et on ne
 * propose pas un bien vendu. Le fil passe vrai ; la fiche d'un mandat, son statut.
 *
 * ⛔ Réactiver n'écrit rien à l'acheteur : c'est l'agent qui l'appellera (conception de la boucle, §1).
 * ⚠ Les anciens prospects ne se demandent au moteur qu'après `delaiProspects` : dans le fil, parcourir les en-têtes aux
 * flèches relirait sinon les recherches closes de l'agence à chaque passage. Sur une fiche, tout de suite.
 * ⚠ `pret` ne revient PAS à faux quand le bien change : le délai passé sur un bien, le suivant serait noté sans attendre.
 * Le composant suppose donc d'être REMONTÉ à chaque bien — le fil le fait par la `key` de son conteneur (`MatchingFil`) ;
 * les fiches passent un délai de 0, et n'ont rien à attendre.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAnciensProspects, type AncienProspect } from '@/hooks/useAnciensProspects'
import { initiales, palierScore } from './filModele'
import { dateCourte, dateLongue, montant } from './filAffichage'
import { etatCompatible, trierCompatibles, type Compatible } from './filQuiPour'
import { FilAvatar, FilBouton, FilScore } from './filAtomes'

interface Props {
  sp: CrmPalette
  /** Le bien : un mandat a des anciens prospects, une annonce du marché non. */
  bien: { genre: 'mandat' | 'annonce'; id: string; location: boolean }
  compatibles: readonly Compatible[]
  /** L'heure de la lecture : un report se compare à elle. */
  maintenant: number
  /** Le geste qui ouvre un compatible, ou `null` s'il n'a pas de place à ouvrir. */
  ouvrir: (m: Compatible) => (() => void) | null
  onVoirContact: (contactId: string) => void
  /** Le délai avant de noter les anciens prospects ; 0 : tout de suite. */
  delaiProspects: number
  /** Montrer les anciens prospects, et donc appeler le moteur : un mandat ACTIF seulement (sans effet sur une annonce). */
  avecAnciens: boolean
}

export default function QuiPourCeBien({ sp, bien, compatibles, maintenant, ouvrir, onVoirContact, delaiProspects, avecAnciens }: Props) {
  const { t } = useTranslation('matching')
  const toast = useToast()
  const montrerAnciens = bien.genre === 'mandat' && avecAnciens
  const [pret, setPret] = useState(delaiProspects <= 0)
  useEffect(() => {
    if (delaiProspects <= 0) return
    const minuterie = setTimeout(() => setPret(true), delaiProspects)
    return () => clearTimeout(minuterie)
  }, [bien.id, delaiProspects])
  const prospects = useAnciensProspects(montrerAnciens && pret ? bien.id : null)
  const tries = trierCompatibles(compatibles)
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
    <>
      <div>
        <h3 style={titre}>{t('fil.quiPour.compatibles', { count: tries.length })}</h3>
        {tries.length === 0 ? <p style={aide}>{t('fil.quiPour.aucunCompatible')}</p> : (
          <ul style={liste}>
            {tries.map((m) => {
              const geste = ouvrir(m)
              return (
                <li key={m.id} style={ligne}>
                  <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <button type="button" onClick={() => onVoirContact(m.acheteur.id)} style={nom}>{m.acheteur.prenom} {m.acheteur.nom}</button>
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{texteEtat(m, maintenant, bien.location, t)}</span>
                  </span>
                  <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
                  {geste && (
                    <FilBouton sp={sp} compact onClick={geste}>
                      {t('fil.quiPour.ouvrir')}<span className="sr-only"> {m.acheteur.prenom} {m.acheteur.nom}</span>
                    </FilBouton>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {montrerAnciens && (
        <div>
          <h3 style={titre}>{t('fil.quiPour.anciens')}</h3>
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
      )}
    </>
  )
}

/** L'état d'un compatible, écrit. */
function texteEtat(m: Compatible, maintenant: number, location: boolean, t: TFunction): string {
  const e = etatCompatible(m, maintenant)
  switch (e.cle) {
    case 'reporte': return t('fil.quiPour.etat.reporte', { date: dateCourte(e.date) })
    case 'aProposer': return t('fil.quiPour.etat.aProposer')
    case 'revenu': return t('fil.quiPour.etat.revenu', { prix: montant(location, e.prix, t) })
    case 'propose': return t('fil.quiPour.etat.propose', { date: dateCourte(e.date) })
    case 'proposeSansDate': return t('fil.quiPour.etat.proposeSansDate')
    case 'interesse': return t('fil.quiPour.etat.interesse')
    case 'visite': return t('fil.quiPour.etat.visite')
    case 'refuse': return t('fil.quiPour.etat.refuse', { motif: t(e.motif) })
    case 'refuseSansMotif': return t('fil.quiPour.etat.refuseSansMotif')
    default: {
      // Un état ajouté à `etatCompatible` sans son texte ne compile plus. Une clé bâtie sur `e.cle` l'aurait affiché
      // sans ses valeurs (une date, un prix restés `{{…}}`), et rien ne l'aurait signalé.
      const inconnu: never = e
      return inconnu
    }
  }
}

/** Ce qui fait un ancien prospect, daté avec l'année : un deal perdu remonte jusqu'à 24 mois. */
function origine(p: AncienProspect, t: TFunction): string {
  if (p.origine === 'deal_perdu') return p.depuis ? t('fil.quiPour.dealPerdu', { date: dateLongue(p.depuis) }) : t('fil.quiPour.dealPerduSansDate')
  return p.depuis ? t('fil.quiPour.rechercheClose', { date: dateLongue(p.depuis) }) : t('fil.quiPour.rechercheCloseSansDate')
}
