/**
 * « Affaire conclue » : le panneau de CLÔTURE (27.09.2026). Il remplace le bento « suites naturelles »
 * du board d'avant, qui proposait « Planifier l'acte » à une affaire dont l'acte était déjà passé.
 *
 * Une liste de suites COCHÉES par défaut, que l'agent valide d'un geste : il décoche ce qui ne
 * s'applique pas. Une ligne n'apparaît que si elle a quelque chose à régler (pas de bien lié, pas de
 * « Marquer le bien vendu »). Le moteur est `useClotureAffaire`.
 *
 * ⛔ ÉPURÉ (Julien, 27.09.2026 : « règle numéro 1 ») : un titre par ligne, sans sous-ligne ni phrase
 * d'aide. Seule exception, une DONNÉE : les noms des acheteurs à prévenir, dans le titre même.
 * « Féliciter » est retirée le 28.09.2026 : une attention ne se coche pas dans une liste d'hygiène.
 * « Rouvrir », « Voir la fiche » et le sous-titre « client × bien » aussi, le même jour : le panneau
 * ne dit plus que la conclusion et ses suites. Une conclusion par erreur se défait sur la fiche de
 * l'affaire, qui garde son bouton « Rouvrir ».
 *
 * ⛔ CENTRÉ, ET RENDU UNE FOIS LA LECTURE FAITE (Julien, 28.09.2026 : « centrée sur le milieu »).
 * Ancré en haut jusque-là, parce que ses lignes arrivaient après la lecture et qu'une modale centrée
 * aurait sauté : il n'apparaît donc qu'avec ses lignes, et le piège du focus s'arme à ce moment-là
 * (armé plus tôt, il ne trouvait pas encore de conteneur, et Échap ne fermait rien).
 *
 * Monté dans le pager (`cadre`), comme « Nouveau deal » et « Perdu » : son flou n'en déborde pas.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { useClotureAffaire, useCloturerAffaire } from '@/hooks/useClotureAffaire'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { crmVoileAssombrissant, crmVoileEncre, type CrmPalette } from '../tokens'
import { ETAPES_APRES_VENTE, dateEtape } from './apresVente'
import { ton } from './tons'

type Cle = 'bien' | 'recherche' | 'prevenir' | 'relances' | 'apresVente'

interface Props {
  sp: CrmPalette
  dealId: string
  /** Le nom du contact : l'intitulé de la clôture au journal. */
  nom: string
  cadre?: HTMLElement | null
  onFermer: () => void
  onEnregistree: () => void
}

export function ClotureAffaire({
  sp, dealId, nom, cadre, onFermer, onEnregistree,
}: Props) {
  const { t, i18n } = useTranslation('pipeline')
  const { data: etat, isError } = useClotureAffaire(dealId)
  const pret = !!etat || isError
  const cloturer = useCloturerAffaire()
  const piege = useFocusTrap(pret, onFermer)
  const [choix, setChoix] = useState<Partial<Record<Cle, boolean>>>({})
  const [erreur, setErreur] = useState(false)

  // Le sceau : un vert FONCÉ plein et une coche blanche, dans les deux thèmes (Julien, 28.09.2026).
  // La valeur est l'encre « succès » du dépôt (`--color-success-dark`), pas une teinte inventée ;
  // la coche se dérive (blanc, 5,5:1).
  const sceau = STATUT_CLAIR.okInk
  const liste = (noms: string[]) => {
    const vus = noms.length > 3 ? [...noms.slice(0, 2), t('cloture.autres', { count: noms.length - 2 })] : noms
    return new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }).format(vus)
  }

  const lignes: { cle: Cle; icone: MEIconName; titre: string }[] = []
  if (etat?.bien && etat.bien.statut !== 'sold' && etat.bien.statut !== 'archived') {
    lignes.push({ cle: 'bien', icone: 'home', titre: etat.bien.location ? t('cloture.bienRetire') : t('cloture.bienVendu') })
  }
  if (etat && etat.recherches.length > 0) lignes.push({ cle: 'recherche', icone: 'pause', titre: t('cloture.recherche') })
  if (etat && etat.suiveurs.length > 0) {
    lignes.push({ cle: 'prevenir', icone: 'bell', titre: t('cloture.prevenir', { noms: liste(etat.suiveurs.map((s) => s.nom)) }) })
  }
  if (etat && etat.relances.length > 0) lignes.push({ cle: 'relances', icone: 'clock', titre: t('cloture.relances', { count: etat.relances.length }) })
  if (etat?.contactId && etat.apresVente.length === 0) lignes.push({ cle: 'apresVente', icone: 'calendar', titre: t('apresVente.planifier') })
  // Toutes cochées par défaut : l'agent retire ce qui ne s'applique pas.
  const coche = (cle: Cle) => lignes.some((l) => l.cle === cle) && (choix[cle] ?? true)

  const valider = async () => {
    if (!etat || cloturer.isPending) return
    setErreur(false)
    const suiveurs = etat.suiveurs.map((s) => s.nom)
    try {
      await cloturer.mutateAsync({
        dealId, contactId: etat.contactId, objectLabel: nom,
        bien: coche('bien') && etat.bien ? { id: etat.bien.id, statut: etat.bien.location ? 'archived' : 'sold' } : undefined,
        recherches: coche('recherche') ? etat.recherches : undefined,
        prevenir: coche('prevenir')
          ? { nombre: suiveurs.length, at: dateEtape(new Date(), 1), note: t('cloture.noteRappel', { noms: liste(suiveurs), bien: etat.bien?.titre ?? '' }) }
          : undefined,
        relances: coche('relances') ? etat.relances : undefined,
        apresVente: coche('apresVente')
          ? ETAPES_APRES_VENTE.map((e) => ({ jours: e.jours, kind: e.kind, at: dateEtape(new Date(), e.jours), note: t(`apresVente.etapes.${e.cle}`) }))
          : undefined,
      })
      onEnregistree()
      onFermer()
    } catch {
      setErreur(true)
    }
  }

  return createPortal(
    // Le voile épouse le pager (réglages de `MailModalShell` : voile 0,4, flou 6 px) ; un clic
    // dehors vaut « Plus tard », rien ne se perd.
    <div onClick={onFermer} style={{
      position: cadre ? 'absolute' : 'fixed', inset: 0, zIndex: cadre ? 130 : 140, borderRadius: cadre ? 'inherit' : undefined,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--crm-space-7xl)',
      background: crmVoileAssombrissant(0.4), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      animation: 'sgSignVeil .15s ease-out',
    }}>
      {pret && (
        <div ref={piege} role="dialog" aria-modal="true" aria-label={t('cloture.titre')} onClick={(e) => e.stopPropagation()} style={{
          width: 440, maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column',
          background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, borderRadius: 'var(--crm-radius-6xl)',
          boxShadow: sp.solidShadow, overflow: 'hidden', color: sp.ink,
          fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
          animation: 'crm-fade-up .3s cubic-bezier(.2,.8,.2,1) both',
        }}>
          {/* L'en-tête : la conclusion se dit d'abord, au centre. */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            gap: 'var(--crm-space-md)', padding: 'var(--crm-space-6xl) var(--crm-space-4xl) var(--crm-space-3xl)',
          }}>
            <span style={{
              width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center',
              background: sceau, animation: 'sgSealIn .4s cubic-bezier(.2,.8,.2,1) .05s both',
            }}><MEIcon name="check" size={24} strokeWidth={2.2} color={encreSur(sceau)} /></span>
            <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.4 }}>{t('cloture.titre')}</div>
          </div>

          {/* Les suites : une liste groupée, l'icône dit l'objet, la case à droite dit ce qui part. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 var(--crm-space-2xl)' }}>
            {etat && lignes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--crm-space-md) 0', fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('cloture.rien')}</div>
            ) : (
              <div style={{ border: `1px solid ${sp.cardBorder}`, borderRadius: 'var(--crm-radius-xl)', overflow: 'hidden' }}>
                {lignes.map((l, i) => {
                  const on = coche(l.cle)
                  return (
                    <button key={l.cle} type="button" role="checkbox" aria-checked={on}
                      onClick={() => setChoix((c) => ({ ...c, [l.cle]: !on }))}
                      onMouseEnter={(e) => { e.currentTarget.style.background = sp.focusSurface }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%', textAlign: 'left',
                        padding: 'var(--crm-space-lg) var(--crm-space-xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                        background: 'transparent', borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
                        transition: 'background .12s',
                      }}>
                      <span aria-hidden style={{
                        width: 30, height: 30, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, display: 'grid', placeItems: 'center',
                        background: crmVoileEncre(sp.isDark, sp.isDark ? 0.06 : 0.05),
                      }}><MEIcon name={l.icone} size={15} color={on ? sp.ink : sp.sub} /></span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: on ? sp.ink : sp.sub }}>{l.titre}</span>
                      <span aria-hidden style={{
                        width: 20, height: 20, borderRadius: 'var(--crm-radius-xs)', flexShrink: 0, display: 'grid', placeItems: 'center',
                        background: on ? sp.accent : 'transparent', boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${sp.cardBorder}`,
                        transition: 'background .12s',
                      }}>{on && <MEIcon name="check" size={12} color={sp.accentInk} />}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Le pied : les deux gestes à parts égales, sous un en-tête centré. L'erreur s'écrit au-dessus. */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', flexShrink: 0,
            padding: 'var(--crm-space-3xl) var(--crm-space-2xl) var(--crm-space-2xl)',
          }}>
            {(erreur || isError) && (
              <span style={{ textAlign: 'center', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ton('retard', sp).encre }}>{t('cloture.erreur')}</span>
            )}
            <div style={{ display: 'flex', gap: 'var(--crm-space-lg)' }}>
              <button type="button" onClick={onFermer} style={{
                flex: 1, height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer',
                border: `1px solid ${sp.cardBorder}`, background: 'transparent', color: sp.ink,
                fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
              }}>{t('cloture.plusTard')}</button>
              {/* ⚠ Le focus d'ouverture est ICI, pas sur le premier focalisable : c'était « Rouvrir »,
                  où un Entrée défaisait la conclusion ; ce serait aujourd'hui une case à décocher. */}
              <button type="button" autoFocus onClick={() => void valider()} aria-disabled={!etat} style={{
                flex: 1, height: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                cursor: etat ? 'pointer' : 'default', background: sp.accent, color: sp.accentInk,
                fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, opacity: !etat || cloturer.isPending ? 0.7 : 1,
              }}>{cloturer.isPending ? t('cloture.enCours') : t('cloture.valider')}</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    cadre ?? document.body,
  )
}
