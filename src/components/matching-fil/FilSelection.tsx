/**
 * La sélection du MARCHÉ d'un acheteur (lot 2, conception §5) : ses biens du marché pas encore
 * proposés, du meilleur au moins bon, cochables, et UN geste pour tous : « J'ai proposé N biens ».
 * ⛔ Rien ne part vers l'acheteur (21.09.2026) : l'agent les lui a présentés, le CRM le consigne.
 *
 * ⚠ Les biens qui tiennent CHAQUE critère posé sont cochés d'office (5 au plus, `precoches`, calculé et
 * FIGÉ par `MatchingFil`) ; le reste se coche à la main. Décocher n'écrit rien. « Écarter » écrit (le
 * couple n'est plus proposé) et passe par la même fenêtre d'annulation que dans le panneau d'un bien.
 *
 * ⚠ Seul ce qui reste À VÉRIFIER s'affiche, pas la grille complète : sur vingt biens, c'est ce qui les
 * distingue. Même règle que le pré-cochage (`criteresNonTenus`) : un bien laissé décoché dit pourquoi.
 *
 * ⚠ Chaque case porte `data-bien` : `MatchingFil` y rend le focus après un « Écarter » ou son annulation.
 */
import { useId, useLayoutEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { criteresNonTenus, initiales, lignesCriteres, palierScore, type FilMatch, type FilSelectionResume } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, teinteEcart, teinteTenu } from './filAffichage'
import { FilAvatar, FilScore, FilVignette } from './filAtomes'
import { resumeRecherche } from './filValeurs'

interface Props {
  sp: CrmPalette
  resume: FilSelectionResume
  matchs: FilMatch[]
  coches: readonly string[]
  aPlus: boolean
  isLoading: boolean
  /** La dernière lecture a échoué. */
  isError: boolean
  /** Une liste de cet acheteur est lisible : un échec s'affiche alors SOUS elle, sans la retirer. */
  aDesDonnees: boolean
  /** Une lecture est en route (« Voir 20 de plus », actualisation après un geste). */
  isFetching: boolean
  onCocher: (id: string, coche: boolean) => void
  onEcarter: (m: FilMatch) => void
  onVoirPlus: () => void
  onReessayer: () => void
  onProposer: () => void
  onVoirContact: () => void
}

/** Le second clic d'un double clic tombe sur ce que le premier a déplacé : ignoré (`detail` 2). */
const unSeulClic = (faire: () => void) => (e: MouseEvent) => { if (e.detail > 1) return; faire() }

export default function FilSelection({
  sp, resume, matchs, coches, aPlus, isLoading, isError, aDesDonnees, isFetching,
  onCocher, onEcarter, onVoirPlus, onReessayer, onProposer, onVoirContact,
}: Props) {
  const { t, i18n } = useTranslation('matching')
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const raisonId = useId()
  const { acheteur } = resume
  const reference = matchs[0]
  const echecSeul = isError && !aDesDonnees
  const listeChargee = !isLoading && !echecSeul
  const bloque = coches.length === 0
  // « Cochez au moins un bien » n'a de sens que devant une liste : pas sous un squelette, une erreur ou
  // « Aucun bien du marché ».
  const raison = bloque && listeChargee && matchs.length > 0 ? t('fil.selection.aucunCoche') : null
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600,
  }
  // ⚠ Pendant sa lecture, « Voir 20 de plus » reste LE MÊME bouton, libellé inchangé ; lui comme
  // « Réessayer » sont désactivés par `aria-disabled` et non par `disabled` : un bouton `disabled` perd le
  // focus, qui retombait sur `<body>` hors du clavier du fil.
  // ⚠ LE FOCUS SUIT LA LECTURE qu'un de ces boutons lance, s'il l'avait : à la fin, la première case
  // chargée le prend (réussite), ou « Réessayer » (échec). Sans quoi le bouton disparaissait sous le
  // focus et `MatchingFil` le rendait à la ligne du fil, loin des biens qu'on venait de demander.
  // `attente` note, au clic, combien de biens étaient déjà là : la première case nouvelle est à ce rang.
  const section = useRef<HTMLElement>(null)
  const reessayer = useRef<HTMLButtonElement>(null)
  const voirPlus = useRef<HTMLButtonElement>(null)
  const attente = useRef<{ avant: number; bouton: HTMLElement } | null>(null)
  const lancer = (faire: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail > 1 || isFetching) return
    attente.current = document.activeElement === e.currentTarget ? { avant: matchs.length, bouton: e.currentTarget } : null
    faire()
  }
  useLayoutEffect(() => {
    const lecture = attente.current
    if (!lecture) return
    const actif = document.activeElement
    const perdu = actif == null || actif === document.body
    if (isFetching) {
      // ⚠ « Réessayer » ne tient PAS pendant sa propre lecture : la requête en échec n'avait pas de
      // données, TanStack la repasse en attente, et la page d'avant revient en données provisoires — sous
      // elle, « Voir 20 de plus » occupé. Ce remplaçant prend le focus jusqu'à la fin ; sinon il tombait
      // sur `<body>` et `MatchingFil` le rendait à la ligne du fil.
      if (perdu && !lecture.bouton.isConnected && voirPlus.current) {
        voirPlus.current.focus()
        lecture.bouton = voirPlus.current
      }
      return
    }
    attente.current = null
    // L'agent est allé ailleurs pendant la lecture : on ne lui reprend pas le focus. Resté sur le bouton,
    // ou retombé sur `<body>` parce que le bouton vient de disparaître : on le mène à la suite.
    if (actif !== lecture.bouton && !perdu) return
    if (isError) { reessayer.current?.focus(); return }
    const cases = section.current?.querySelectorAll<HTMLElement>('[data-bien]')
    if (cases?.length) (cases[lecture.avant] ?? cases[cases.length - 1])?.focus()
  })
  const erreur = (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
      <p role="alert" style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: sp.ink }}>{t('fil.selection.erreur')}</p>
      <button ref={reessayer} type="button" onClick={lancer(onReessayer)} aria-disabled={isFetching || undefined} aria-busy={isFetching || undefined}
        style={{ ...lien, fontSize: 'var(--crm-text-sm)', color: encreAccent(sp), cursor: isFetching ? 'progress' : 'pointer' }}>
        {t('fil.reessayer')}
      </button>
    </div>
  )
  return (
    <section ref={section} aria-label={t('fil.selection.titreAria', { nom: `${acheteur.prenom} ${acheteur.nom}` })}
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
              {t('fil.selection.marche')} · {t('fil.selection.ligne', { count: resume.nombre })}
            </div>
          </div>
        </div>

        {reference && lignesCriteres(reference).length > 0 && (
          <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
            {t('fil.selection.recherche', { resume: resumeRecherche(reference, t, nombre) })}
          </p>
        )}

        {isLoading ? (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
            <span className="sr-only">{t('fil.chargement')}</span>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 68, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }} />)}
          </div>
        ) : echecSeul ? erreur : matchs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('fil.selection.vide')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
            {matchs.map((m) => (
              <Bien key={m.id} sp={sp} m={m} coche={coches.includes(m.id)} nombre={nombre} onCocher={onCocher} onEcarter={onEcarter} />
            ))}
          </ul>
        )}

        {/* ⚠ Un échec APRÈS une liste (« Voir 20 de plus », actualisation) la garde, et le dit dessous. */}
        {listeChargee && isError ? erreur : listeChargee && aPlus && (
          <button ref={voirPlus} type="button" onClick={lancer(onVoirPlus)} aria-disabled={isFetching || undefined} aria-busy={isFetching || undefined} style={{
            ...lien, alignSelf: 'flex-start', fontSize: 'var(--crm-text-sm)', color: encreAccent(sp),
            opacity: isFetching ? 0.5 : 1, cursor: isFetching ? 'progress' : 'pointer',
          }}>
            {t('fil.selection.voirPlus')}
          </button>
        )}
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`,
        background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        {raison && <span id={raisonId} style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{raison}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={unSeulClic(onProposer)} disabled={bloque}
          aria-describedby={raison ? raisonId : undefined} aria-keyshortcuts="E" title={t('fil.actions.raccourci', { touche: 'E' })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40,
            paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
            border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
            background: sp.accent, color: sp.accentInk, opacity: bloque ? 0.5 : 1, cursor: bloque ? 'not-allowed' : 'pointer',
          }}>
          {/* « J'ai proposé 0 bien à Julie » se lit mal : à zéro, le bouton (désactivé, sa raison à côté) ne compte pas. */}
          {coches.length === 0 ? t('fil.selection.proposerAucun', { prenom: acheteur.prenom })
            : t('fil.selection.proposer', { count: coches.length, prenom: acheteur.prenom })}
        </button>
      </div>
    </section>
  )
}

function Bien({ sp, m, coche, nombre, onCocher, onEcarter }: {
  sp: CrmPalette; m: FilMatch; coche: boolean; nombre: (n: number) => string
  onCocher: (id: string, coche: boolean) => void; onEcarter: (m: FilMatch) => void
}) {
  const { t } = useTranslation('matching')
  const lignes = lignesCriteres(m)
  const aVerifier = criteresNonTenus(lignes)
  // Aucun verdict du tout : le dire tel quel plutôt que lister chaque critère « à vérifier ».
  const nonEvalues = lignes.length > 0 && lignes.every((l) => l.ok === null)
  const details = [
    prixBien(m.bien, t),
    m.bien.pieces != null ? t('fil.selection.pieces', { count: m.bien.pieces, valeur: nombre(m.bien.pieces) }) : null,
    m.bien.surface != null ? t('fil.valeurs.m2', { valeur: nombre(m.bien.surface) }) : null,
  ].filter(Boolean).join(' · ')
  const resume = lignes.length === 0 ? t('fil.sansCriteres')
    : aVerifier.length === 0 ? t('fil.sansEcart')
      : nonEvalues ? t('fil.nonEvalues')
        : t('fil.selection.ecarts', { liste: aVerifier.map((c) => t(`fil.criteres.${c}`)).join(', ') })
  const icone = lignes.length === 0 || nonEvalues ? null : aVerifier.length > 0 ? 'alert' : 'check'
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
      borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg,
      // L'élément choisi porte l'accent (CLAUDE.md §3).
      border: `1px solid ${coche ? encreAccent(sp) : sp.cardBorder}`,
    }}>
      <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', cursor: 'pointer' }}>
        <input type="checkbox" checked={coche} onChange={(e) => onCocher(m.id, e.target.checked)} data-bien={m.id}
          aria-label={t('fil.selection.inclure', { titre: m.bien.titre })}
          style={{ width: 16, height: 16, flex: 'none', margin: 0, accentColor: encreAccent(sp), cursor: 'pointer' }} />
        <FilVignette sp={sp} photo={m.bien.photo} largeur={56} hauteur={42} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.bien.titre}
          </span>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {icone && (
              <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
                <MEIcon name={icone} size={12} color={icone === 'alert' ? teinteEcart(sp) : teinteTenu(sp)} />
              </span>
            )}
            {resume}
          </span>
        </span>
      </label>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
      <button type="button" onClick={unSeulClic(() => onEcarter(m))} aria-label={t('fil.selection.ecarterAria', { titre: m.bien.titre })} style={{
        border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
        fontWeight: 600, color: sp.sub, padding: 'var(--crm-space-xs) var(--crm-space-sm)',
      }}>
        {t('fil.actions.ecarter')}
      </button>
    </li>
  )
}
