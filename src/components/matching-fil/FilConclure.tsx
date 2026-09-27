/**
 * « À conclure » (conception de la boucle, §4.5) : un bien qui INTÉRESSE un acheteur, et sa visite à
 * planifier — EN INTERNE : rien n'est envoyé à l'acheteur, ni invitation ni lien (comme l'outil
 * `schedule_visit` du copilote). Le match passe `visit_planned`, le deal avance (`execPlanifierVisite`).
 *
 * ⚠ Deux destinations, un seul geste : un bien EN MANDAT reçoit une visite (`visits`) ; une annonce du
 * MARCHÉ, que l'agence ne détient pas, entre dans l'agenda comme événement « visite » (`calendar_events`).
 * Pas de fenêtre d'annulation : c'est un formulaire validé. V porte le focus sur la date, et « Planifier la
 * visite » de la barre d'annulation (après « Intéressé ») l'y pose d'office (`focusDate`).
 *
 * ⛔ PAS `PlanifierVisite` (fiche d'un bien) : il ne connaît que les biens en mandat, il redemande le
 * visiteur, et son dernier pas prépare un message de confirmation au CLIENT (WhatsApp, e-mail) — ce que le
 * matching ne fait plus (`matching-sans-sortie.spec.ts`). Mêmes durées (30 à 90 minutes).
 *
 * ⚠ L'annonce d'origine s'ouvre par un LIEN (`<a>`), jamais par `window.open` : son adresse vient du
 * portail, et seul un `http(s)` est rendu cliquable.
 *
 * ⚠ L'horloge est FIGÉE à l'ouverture (`ouvertLe`, comme `PlanifierVisite`) : un rendu reste pur, et la date
 * proposée ne bouge pas pendant la saisie.
 *
 * ⚠ « Pas intéressé » (N) reste possible : un intérêt peut retomber, et sans ce geste la ligne n'aurait pas
 * de sortie.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format } from 'date-fns'
import type { CrmPalette } from '@/components/crm/tokens'
import type { VisiteAPlanifier } from '@/hooks/useAtelierMatching'
import { initiales, palierScore, type FilMatch } from './filModele'
import type { MotifRefus } from './filBoucle'
import { dateCourte, encreAccent, MARGE_POINTS, prixBien } from './filAffichage'
import { FilAvatar, FilBouton, FilScore, FilVignette } from './filAtomes'
import FilMotifs from './FilMotifs'

interface Props {
  sp: CrmPalette
  m: FilMatch
  motifsOuverts: boolean
  /** Une visite est en cours d'écriture : le bouton se grise. */
  occupe: boolean
  /** La visite vient d'être demandée depuis la barre d'annulation : la date prend le focus. */
  focusDate: boolean
  onPlanifier: (visite: VisiteAPlanifier) => void
  onPasInteresse: () => void
  onMotif: (motif: MotifRefus, note: string | null) => void
  onFermerMotifs: () => void
  onVoirBien: () => void
  onVoirContact: () => void
}

const DUREES = [30, 45, 60, 90]
/** Une date locale `AAAA-MM-JJ` (le format d'un `<input type="date">`). */
const jourIso = (d: Date): string => format(d, 'yyyy-MM-dd')

export default function FilConclure({
  sp, m, motifsOuverts, occupe, focusDate, onPlanifier, onPasInteresse, onMotif, onFermerMotifs, onVoirBien, onVoirContact,
}: Props) {
  const { t } = useTranslation('matching')
  const formId = useId()
  const aideId = useId()
  const dateRef = useRef<HTMLInputElement>(null)
  const [ouvertLe] = useState(() => new Date())
  // Même défaut que `VisitNewPage` : dans deux jours, à 14 h, 45 minutes.
  const [date, setDate] = useState(() => jourIso(addDays(ouvertLe, 2)))
  const [heure, setHeure] = useState('14:00')
  const [duree, setDuree] = useState(45)
  useEffect(() => { if (focusDate) dateRef.current?.focus() }, [focusDate])
  const { bien, acheteur } = m
  const debut = date && heure ? new Date(`${date}T${heure}:00`) : null
  const valide = debut != null && Number.isFinite(debut.getTime()) && debut.getTime() > ouvertLe.getTime()
  const repondu = m.suivi?.reponduLe
  const lienAnnonce = bien.marche?.sourceUrl && /^https?:\/\//i.test(bien.marche.sourceUrl) ? bien.marche.sourceUrl : null
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp), textDecoration: 'none',
  }
  const champ: CSSProperties = {
    height: 36, border: `1px solid ${sp.cardBorder}`, borderRadius: 'var(--crm-radius-md)', background: sp.cardBg, color: sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
    colorScheme: sp.isDark ? 'dark' : 'light',
  }
  const libelle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }
  const soumettre = () => {
    if (!valide || occupe || !debut) return
    onPlanifier({ debut: debut.toISOString(), dureeMinutes: duree, lieu: [bien.adresse, bien.ville].filter(Boolean).join(', ') || null })
  }
  return (
    <section aria-label={t('fil.conclure.titreAria', { acheteur: `${acheteur.prenom} ${acheteur.nom}`, bien: bien.titre })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)' }}>
          <FilVignette sp={sp} photo={bien.photo} largeur={96} hauteur={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
            }}>
              {t(bien.marche ? 'fil.selection.marche' : 'fil.votreBien')}
            </span>
            <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
              {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
            </p>
            {bien.marche
              ? lienAnnonce && (
                <a href={lienAnnonce} target="_blank" rel="noopener noreferrer" style={{ ...lien, display: 'inline-block', marginTop: 'var(--crm-space-sm)' }}>
                  {t('fil.conclure.voirAnnonce')}
                </a>
              )
              : <button type="button" onClick={onVoirBien} style={{ ...lien, marginTop: 'var(--crm-space-sm)' }}>{t('fil.voirBien')}</button>}
          </div>
          <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} grand />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-lg)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            {repondu && <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.conclure.interesseLe', { date: dateCourte(repondu) })}</div>}
          </div>
        </div>

        <form id={formId} onSubmit={(e) => { e.preventDefault(); soumettre() }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{t('fil.conclure.planifier')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
            <label style={libelle}>
              {t('fil.conclure.date')}
              <input ref={dateRef} type="date" data-visite-date value={date} min={jourIso(ouvertLe)} onChange={(e) => setDate(e.target.value)}
                aria-describedby={aideId} aria-keyshortcuts="V" style={champ} />
            </label>
            <label style={libelle}>
              {t('fil.conclure.heure')}
              <input type="time" value={heure} step={900} onChange={(e) => setHeure(e.target.value)} style={champ} />
            </label>
            <label style={libelle}>
              {t('fil.conclure.duree')}
              <select value={duree} onChange={(e) => setDuree(Number(e.target.value))} style={{ ...champ, cursor: 'pointer' }}>
                {DUREES.map((n) => <option key={n} value={n}>{t('fil.conclure.minutes', { n })}</option>)}
              </select>
            </label>
          </div>
          <p id={aideId} style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
            {valide
              ? t(bien.marche ? 'fil.conclure.agenceAnnonce' : 'fil.conclure.aucuneInvitation', { prenom: acheteur.prenom })
              : t('fil.conclure.dateRequise')}
          </p>
        </form>

        {motifsOuverts && <FilMotifs sp={sp} onChoisir={onMotif} onAnnuler={onFermerMotifs} />}
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`,
        background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} touche="N" ouvert={motifsOuverts} onClick={onPasInteresse}>{t('fil.retours.pasInteresse')}</FilBouton>
        <span style={{ flex: 1 }} />
        <button type="submit" form={formId} disabled={!valide || occupe} aria-describedby={aideId} style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40,
          paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
          border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
          background: sp.accent, color: sp.accentInk, opacity: !valide || occupe ? 0.5 : 1,
          cursor: !valide || occupe ? 'not-allowed' : 'pointer',
        }}>
          {t('fil.conclure.confirmer')}
        </button>
      </div>
    </section>
  )
}
