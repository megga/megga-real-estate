/**
 * « Nouveau bien » — la création d'annonce en QUATRE étapes, avec l'aperçu en direct.
 *
 * ⚖ Refonte du 16.09.2026 (Julien : « plus facile, plus simple, plus lisible »), qui a
 * REMPLACÉ l'ancien wizard le jour même. Celui-ci (`WizardShell`, retiré) comptait six
 * étapes et leurs sous-écrans —
 * Vendeur, Mandat, Adresse, SEPT questions de caractéristiques, Photos, Prix, Description,
 * Publication : ~14 « Suivant » pour un bien. Celui-ci :
 *
 *   1. Le bien        transaction, type, adresse, chiffres clés, prix — un écran
 *   2. Photos         déposer, réordonner, couverture
 *   3. L'annonce      titre proposé, description (MEGGA AI en assistance), atouts
 *   4. Mandat & diff. vendeur FACULTATIF, mandat, agence partenaire, puis Publier
 *
 * À droite, la carte telle qu'elle apparaîtra dans « Mes biens » (la vraie `GalCard`) et
 * ce qui manque, cliquable. Les étapes portent un NOM et se rejoignent librement (idiome
 * « pilules à libellé » du CRM, CLAUDE.md §3).
 *
 * ⚠ La mécanique d'écriture est celle de l'ancien wizard, gardée telle quelle : même état
 * (`WizardData`), même brouillon automatique (`useWizardDraft`, partagé avec le wizard
 * MOBILE), même publication (`usePublierWizard`).
 *
 * 💾 LE BROUILLON SE DIT EN PARTANT, pas pendant la saisie (Julien, 16.09.2026) : l'en-tête
 * ne porte plus de témoin permanent — seul un ÉCHEC s'y affiche. Quitter l'écran (retour,
 * autre page, autre onglet) écrit aussitôt ce que le minuteur n'avait pas encore écrit, puis
 * le dit en bas de l'écran d'arrivée (`annoncerAvis`), en deux mots : « Brouillon enregistré ». Fermer ou recharger le navigateur avec une saisie non écrite
 * déclenche l'alerte native : aucun toast ne survivrait à la page.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmPalette } from '@/components/crm/tokens'
import { mxSurfaces } from '@/components/crm/biens/gallery/galHelpers'
import { GalCard } from '@/components/crm/biens/gallery/GalCard'
import { EMPTY_WIZARD, type WizardData } from '@/components/crm-wizard/tokens'
import { useWizardDraft, wizardPayload } from '@/components/crm-wizard/useWizardDraft'
import { usePublierWizard } from '@/components/crm-wizard/usePublierWizard'
import { useEcranActif } from '@/hooks/useEcranActif'
import { annoncerAvis } from '@/lib/crmAvis'
import { EtapeBien } from './EtapeBien'
import { EtapePhotos } from './EtapePhotos'
import { EtapeAnnonce } from './EtapeAnnonce'
import { EtapeMandat } from './EtapeMandat'
import {
  adresseRemplie, apercuBien, manquesPublication, pointsCompletude, pourcentageCompletude, type ClePoint,
} from './completude'

const ETAPES = ['bien', 'photos', 'annonce', 'mandat'] as const

/** Un bien neuf ne présume ni canton ni vendeur (l'ancien état partait de « Vaud »). */
const VIDE: WizardData = { ...EMPTY_WIZARD, canton: '', country: 'Suisse' }

interface Props {
  dark: boolean
  /** Retour à « Mes biens ». */
  onClose: () => void
  /** Ouvre la fiche du bien enregistré. */
  onOuvrirBien: (id: string) => void
}

export default function NouveauBien({ dark, onClose, onOuvrirBien }: Props) {
  const { t, i18n } = useTranslation('listings')
  const sp = crmPalette(dark)
  const surf = mxSurfaces(sp)
  const [data, setData] = useState<WizardData>(VIDE)
  const set = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }))
  const [etape, setEtape] = useState(0)
  const [fini, setFini] = useState<{ id: string; publie: boolean } | null>(null)
  const { publier, enCours, erreur } = usePublierWizard(set)
  const { etat: brouillon, attendreEcriture, enregistrerMaintenant, nonEcrit } = useWizardDraft(data, set, !enCours && !fini, wizardPayload)
  const ecranActif = useEcranActif()

  // ─── Le départ ───
  // Lu par des refs : le signal part d'un démontage ou d'un onglet masqué, dont les
  // fermetures dateraient du rendu d'avant.
  const dataRef = useRef(data)
  const finiRef = useRef(fini)
  /** La saisie déjà signalée : revenir puis repartir sans rien toucher ne redit rien. */
  const signalee = useRef<WizardData>(VIDE)
  const quitter = useRef(() => {})
  // Déclaré AVANT les deux effets qui lisent `quitter` : dans un même commit, il passe le premier.
  useEffect(() => {
    dataRef.current = data
    finiRef.current = fini
    quitter.current = () => {
      const d = dataRef.current
      if (finiRef.current || d === signalee.current) return
      signalee.current = d
      if (!d.addr?.trim()) {
        // Un brouillon naît avec l'adresse : sans elle, rien n'est gardé — et il faut le dire.
        if (d !== VIDE) annoncerAvis(t('nouveauBien.brouillon.sansAdresse'), { alerte: true })
        return
      }
      void enregistrerMaintenant().then(({ ok }) => {
        if (ok) annoncerAvis(t('nouveauBien.brouillon.quitte'))
        else annoncerAvis(t('nouveauBien.brouillon.echecDepart'), { alerte: true })
      })
    }
  })
  // Autre page (démontage) — en développement, StrictMode démonte une fois à vide : `VIDE` se tait.
  useEffect(() => () => quitter.current(), [])
  // Autre onglet : l'écran reste monté mais passe derrière.
  const etaitActif = useRef(ecranActif)
  useEffect(() => {
    if (etaitActif.current && !ecranActif) quitter.current()
    etaitActif.current = ecranActif
  }, [ecranActif])
  // Fermeture ou rechargement du navigateur : l'alerte native, seulement s'il reste à écrire.
  useEffect(() => {
    if (fini) return
    const avant = (e: BeforeUnloadEvent) => {
      if (!nonEcrit()) return
      void enregistrerMaintenant()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avant)
    return () => window.removeEventListener('beforeunload', avant)
  }, [fini, nonEcrit, enregistrerMaintenant])

  const titreSuggere = useMemo(() => {
    const type = t(`nouveauBien.types.${data.type}`)
    const pieces = data.rooms && data.type !== 'terrain' && data.type !== 'commerce'
      ? t('form.preview.roomsCount', { count: data.rooms }).replace('.', i18n.language?.startsWith('fr') ? ',' : '.')
      : null
    return [[type, pieces].filter(Boolean).join(' '), data.city].filter(Boolean).join(' · ')
  }, [data.type, data.rooms, data.city, t, i18n.language])

  const points = pointsCompletude(data)
  const pourcentage = pourcentageCompletude(points)
  const manques = manquesPublication(points)
  const peutEnregistrer = adresseRemplie(data)

  const suivant = () => setEtape((e) => Math.min(ETAPES.length - 1, e + 1))
  const precedent = () => setEtape((e) => Math.max(0, e - 1))
  const terminer = async (publie: boolean) => {
    const id = await publier({ ...data, title: data.title?.trim() || titreSuggere }, attendreEcriture, publie ? 'active' : 'draft')
    if (id) setFini({ id, publie })
  }

  // Entrée = Continuer — sauf dans un texte long, une recherche à suggestions, ou à la dernière étape.
  useEffect(() => {
    if (!ecranActif || fini) return
    const clavier = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey || e.metaKey || e.ctrlKey || etape === ETAPES.length - 1) return
      // `defaultPrevented` : un champ qui a PRIS l'Entrée (choix d'une adresse) a déjà quitté le DOM
      // quand l'événement atteint `window` — `closest` ne le retrouverait plus.
      const cible = e.target as HTMLElement | null
      if (cible?.tagName === 'TEXTAREA' || cible?.tagName === 'BUTTON' || cible?.closest('[data-nb-sans-entree]')) return
      e.preventDefault()
      setEtape((n) => Math.min(ETAPES.length - 1, n + 1))
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [ecranActif, fini, etape])

  // Chaque étape repart du haut.
  useEffect(() => { document.getElementById('nb-formulaire')?.scrollTo({ top: 0 }) }, [etape])

  const libellePoint = (cle: ClePoint) => t(`nouveauBien.points.${cle}`)

  return (
    <div className="nb" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: sp.cardBg, color: sp.ink, fontFamily: 'var(--crm-font), system-ui, sans-serif' }}>
      <style>{`
        .nb { container: nb / inline-size; }
        .nb-corps { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 360px; }
        /* ⚖ LA LARGEUR EST UTILISÉE (Julien, 16.09.2026 : « en plein écran, les informations
           sont centrées au milieu »). Une colonne bridée à 760 px au centre laissait un vide de
           chaque côté et repoussait le prix sous le pli. Dès que la zone du formulaire le
           permet, chaque étape se range sur DEUX colonnes séparées par un filet — la grammaire
           de la fiche bien ; en dessous, une seule colonne. */
        #nb-formulaire { container: nbform / inline-size; }
        .nb-etape { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--crm-space-6xl); max-width: 760px; margin-inline: auto; }
        .nb-col { display: flex; flex-direction: column; gap: var(--crm-space-6xl); min-width: 0; }
        @container nbform (min-width: 900px) {
          .nb-etape { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: none; margin-inline: initial; align-items: start; column-gap: normal; }
          .nb-etape > .nb-col + .nb-col { padding-left: var(--crm-space-6xl); margin-left: var(--crm-space-6xl); border-left: 1px solid ${sp.cardBorder}; }
          .nb-etape > .nb-plein { grid-column: 1 / -1; }
        }
        .nb-grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--crm-space-lg); }
        .nb-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); grid-auto-flow: dense; gap: var(--crm-space-sm); }
        .nb-puce:not(:disabled):hover, .nb-option:hover { background: ${sp.focusSurface} !important; }
        .nb-champ:focus-within { border-color: ${sp.accent} !important; box-shadow: 0 0 0 3px color-mix(in srgb, ${sp.accent} 18%, transparent); }
        .nb-champ input::placeholder, .nb-champ textarea::placeholder, textarea.nb-champ::placeholder { color: ${sp.sub}; font-weight: 500; }
        .nb-photo .nb-photo-actions { opacity: 0; transition: opacity .15s; }
        .nb-photo:hover .nb-photo-actions, .nb-photo:focus-within .nb-photo-actions { opacity: 1; }
        @media (hover: none) { .nb-photo .nb-photo-actions { opacity: 1; } }
        @container nb (max-width: 980px) {
          .nb-corps { grid-template-columns: minmax(0, 1fr); overflow-y: auto; }
          .nb-apercu { border-left: 0 !important; border-top: 1px solid ${sp.cardBorder}; }
          #nb-formulaire { overflow: visible !important; }
        }
        @container nb (max-width: 640px) { .nb-etape-libelle { display: none; } }
      `}</style>

      {/* ═══ En-tête : retour, titre, étapes nommées ═══ */}
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', flexWrap: 'wrap', padding: 'var(--crm-space-4xl) var(--crm-space-6xl)', borderBottom: `1px solid ${sp.cardBorder}` }}>
        <button type="button" onClick={onClose} aria-label={t('fiche.back')} title={t('fiche.back')} className="nb-puce" style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`, background: 'transparent', color: sp.ink, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <MEIcon name="arrow-left" size={15} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.5 }}>{t('nouveauBien.titre')}</h1>
          {/* Seul l'ÉCHEC se dit pendant la saisie : l'agent doit savoir que rien n'est gardé. */}
          {!fini && brouillon === 'echec' && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              <MEIcon name="alert" size={12} />
              {t('nouveauBien.brouillon.echec')}
            </div>
          )}
        </div>
        {!fini && (
          <nav aria-label={t('nouveauBien.etapesAria')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
            {ETAPES.map((cle, i) => {
              const active = i === etape
              const faite = points.filter((p) => p.etape === i).every((p) => p.fait)
              return (
                <button key={cle} type="button" onClick={() => setEtape(i)} aria-current={active ? 'step' : undefined} className={active ? undefined : 'nb-puce'} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 36, padding: '0 var(--crm-space-lg) 0 var(--crm-space-xs)',
                  borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? sp.accent : 'transparent', color: active ? sp.accentInk : sp.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 600,
                }}>
                  <span aria-hidden style={{
                    width: 28, height: 28, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-sm)',
                    background: active ? 'transparent' : sp.focusSurface, color: active ? sp.accentInk : faite ? sp.accent : sp.sub,
                  }}>
                    {faite && !active ? <MEIcon name="check" size={13} /> : i + 1}
                  </span>
                  <span className="nb-etape-libelle">{t(`nouveauBien.etapes.${cle}`)}</span>
                </button>
              )
            })}
          </nav>
        )}
      </header>

      {fini ? (
        /* ═══ Fini : ce qui a été enregistré, et la suite ═══ */
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 'var(--crm-space-6xl)' }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 'var(--crm-space-2xl)', textAlign: 'center', maxWidth: 520 }}>
            <span style={{ width: 64, height: 64, borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk, display: 'grid', placeItems: 'center' }}>
              <MEIcon name="check" size={28} />
            </span>
            <h2 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 500, letterSpacing: -0.8 }}>
              {fini.publie ? t('nouveauBien.fini.publie') : t('nouveauBien.fini.garde')}
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--crm-text-xl)', color: sp.sub, lineHeight: 1.5 }}>
              {fini.publie ? t('nouveauBien.fini.publieAide', { titre: data.title?.trim() || titreSuggere }) : t('nouveauBien.fini.gardeAide', { titre: data.title?.trim() || titreSuggere })}
            </p>
            <div style={{ width: 320, maxWidth: '100%', textAlign: 'left' }}>
              <GalCard apercu bien={{ ...apercuBien(data, data.title?.trim() || titreSuggere), status: fini.publie ? 'active' : 'draft' }} onOpen={() => {}} sp={sp} surf={surf} dark={dark} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={() => onOuvrirBien(fini.id)} style={bouton(sp, true)}>{t('nouveauBien.fini.ouvrir')}</button>
              <button type="button" className="nb-puce" onClick={() => { setData(VIDE); setEtape(0); setFini(null) }} style={bouton(sp, false)}>{t('nouveauBien.fini.autre')}</button>
              <button type="button" className="nb-puce" onClick={onClose} style={bouton(sp, false)}>{t('nouveauBien.fini.retour')}</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="nb-corps">
            {/* ═══ Le formulaire de l'étape ═══ */}
            <div id="nb-formulaire" style={{ minHeight: 0, overflowY: 'auto', padding: 'var(--crm-space-6xl)' }}>
              <div className="nb-etape">
                {etape === 0 && <EtapeBien data={data} set={set} sp={sp} />}
                {etape === 1 && <EtapePhotos data={data} set={set} sp={sp} />}
                {etape === 2 && <EtapeAnnonce data={data} set={set} titreSuggere={titreSuggere} sp={sp} />}
                {etape === 3 && <EtapeMandat data={data} set={set} dark={dark} sp={sp} />}
              </div>
            </div>

            {/* ═══ L'aperçu : la carte de Mes biens, et ce qui manque ═══ */}
            <aside className="nb-apercu" style={{ minHeight: 0, overflowY: 'auto', padding: 'var(--crm-space-6xl)', borderLeft: `1px solid ${sp.cardBorder}`, background: sp.pageBg, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)' }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.sub }}>{t('nouveauBien.apercu')}</div>
              {/* ⚠ `flexShrink: 0` : dans la colonne qui défile, la carte se tassait jusqu'à ne
                  montrer que sa photo — titre, adresse et prix passaient sous son `overflow`. */}
              <div style={{ flexShrink: 0 }}>
                <GalCard apercu bien={apercuBien(data, data.title?.trim() || titreSuggere)} onOpen={() => {}} sp={sp} surf={surf} dark={dark} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{t('nouveauBien.completude')}</span>
                  <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: sp.ink }}>{pourcentage} %</span>
                </div>
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pourcentage} aria-label={t('nouveauBien.completude')} style={{ height: 6, borderRadius: 'var(--crm-radius-pill)', background: sp.focusSurface, overflow: 'hidden' }}>
                  <div style={{ width: `${pourcentage}%`, height: '100%', background: sp.accent, transition: 'width .3s ease' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
                  {points.map((p) => (
                    <button key={p.cle} type="button" onClick={() => setEtape(p.etape)} className="nb-option" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-md)', borderRadius: 'var(--crm-radius-md)', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span aria-hidden style={{ width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', flexShrink: 0, background: p.fait ? sp.accent : 'transparent', border: p.fait ? 0 : `1.5px solid ${sp.cardBorder}`, color: sp.accentInk }}>
                        {p.fait && <MEIcon name="check" size={11} />}
                      </span>
                      <span style={{ flex: 1, fontSize: 'var(--crm-text-md)', fontWeight: 500, color: p.fait ? sp.sub : sp.ink, textDecoration: p.fait ? 'line-through' : 'none' }}>{libellePoint(p.cle)}</span>
                      {!p.fait && p.requisPublication && <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{t('nouveauBien.requis')}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          {/* ═══ Pied : retour, et l'action de l'étape ═══ */}
          <footer style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap', padding: 'var(--crm-space-2xl) var(--crm-space-6xl)', borderTop: `1px solid ${sp.cardBorder}` }}>
            {etape > 0 && <button type="button" className="nb-puce" onClick={precedent} style={bouton(sp, false)}>{t('nouveauBien.retour')}</button>}
            <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>
              {erreur && <span role="alert" style={{ color: sp.ink }}>{t('wizard.shell.publishError', { message: erreur })}</span>}
            </div>
            {etape < ETAPES.length - 1 ? (
              <button type="button" onClick={suivant} style={bouton(sp, true)}>
                {t('nouveauBien.continuer')} <MEIcon name="arrow-right" size={14} />
              </button>
            ) : (
              <>
                <button type="button" className="nb-puce" disabled={!peutEnregistrer || enCours} onClick={() => void terminer(false)}
                  title={peutEnregistrer ? undefined : t('nouveauBien.adresseAvant')} style={{ ...bouton(sp, false), opacity: !peutEnregistrer || enCours ? 0.5 : 1 }}>
                  <MEIcon name="lock" size={14} />{t('nouveauBien.garder')}
                </button>
                <button type="button" disabled={manques.length > 0 || enCours} onClick={() => void terminer(true)}
                  title={manques.length ? t('nouveauBien.manque', { liste: manques.map(libellePoint).join(', ') }) : undefined}
                  style={{ ...bouton(sp, true), opacity: manques.length > 0 || enCours ? 0.5 : 1 }}>
                  <MEIcon name="globe" size={14} />{enCours ? t('nouveauBien.enCours') : t('nouveauBien.publier')}
                </button>
              </>
            )}
          </footer>
        </>
      )}
    </div>
  )
}

function bouton(sp: ReturnType<typeof crmPalette>, primaire: boolean) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 42, padding: '0 var(--crm-space-3xl)',
    borderRadius: 'var(--crm-radius-pill)', border: primaire ? 0 : `1px solid ${sp.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap' as const,
    background: primaire ? sp.accent : 'transparent', color: primaire ? sp.accentInk : sp.ink,
  }
}
