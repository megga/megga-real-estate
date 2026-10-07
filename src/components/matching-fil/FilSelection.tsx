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
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B), ou en baisse sur le marché (lot C), porte la flèche
 * de sa baisse, et au survol la phrase que le dépli de la carte focus écrit (`texteSignalMatch`) : ici, aucun dépli ne
 * la porte. Un bien nouveau, la pastille « Nouveau » (son libellé au survol). Il passe devant à score égal.
 *
 * ⚠ Le fil épuré (07.10.2026) : le nom seul, la recherche repliée derrière un chevron ; un bien à son prix, ses écarts
 * en icône (leur liste au survol) ; « Proposé · 2 », la phrase entière au survol.
 *
 * ⚠ Chaque case porte `data-bien` : `MatchingFil` y rend le focus après un « Écarter » ou son annulation.
 */
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { criteresNonTenus, initiales, lignesCriteres, palierScore, type FilMatch, type FilSelectionResume } from './filModele'
import {
  baisseDuBien, baisseDuMatch, encreAccent, MARGE_POINTS, prixBien, secondClic, teinteEcart, texteSignalBien, texteSignalMatch,
  unSeulClic,
} from './filAffichage'
import { signalBien } from './filSignaux'
import { FilAvatar, FilBaisse, FilNouveau, FilScore, FilVignette } from './filAtomes'
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
  /** L'heure de la lecture : les signaux « pourquoi maintenant » s'y mesurent (lot C). */
  maintenant: number
}

export default function FilSelection({
  sp, resume, matchs, coches, aPlus, isLoading, isError, aDesDonnees, isFetching,
  onCocher, onEcarter, onVoirPlus, onReessayer, onProposer, onVoirContact, maintenant,
}: Props) {
  const { t, i18n } = useTranslation('matching')
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const raisonId = useId()
  const { acheteur } = resume
  const reference = matchs[0]
  const aRecherche = reference != null && lignesCriteres(reference).length > 0
  // Sa recherche se lit d'un clic, et se replie d'un acheteur à l'autre : l'état retient l'acheteur ouvert.
  const rechercheId = useId()
  const [rechercheOuverte, setRechercheOuverte] = useState<string | null>(null)
  const ouverte = rechercheOuverte === acheteur.id
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
    if (secondClic(e) || isFetching) return
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
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          {/* `aria-controls` ne vise la recherche que quand elle est rendue : repliée, elle n'existe pas (comme le dépli de
              la carte focus). */}
          {aRecherche && (
            <button type="button" aria-expanded={ouverte} aria-controls={ouverte ? rechercheId : undefined}
              aria-label={t('fil.selection.rechercheAria')} title={t('fil.selection.rechercheAria')}
              onClick={() => setRechercheOuverte(ouverte ? null : acheteur.id)}
              style={{ ...lien, display: 'inline-flex', padding: 'var(--crm-space-xs)' }}>
              <MEIcon name={ouverte ? 'chevron-up' : 'chevron-down'} size={16} color={sp.sub} />
            </button>
          )}
        </div>

        {aRecherche && ouverte && (
          <p id={rechercheId} style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
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
              <Bien key={m.id} sp={sp} m={m} coche={coches.includes(m.id)} maintenant={maintenant} onCocher={onCocher} onEcarter={onEcarter} />
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
          aria-describedby={raison ? raisonId : undefined} aria-keyshortcuts="E" title={t('fil.actions.infobulle', {
            libelle: coches.length === 0 ? t('fil.selection.proposerAucun', { prenom: acheteur.prenom })
              : t('fil.selection.proposer', { count: coches.length, prenom: acheteur.prenom }),
            touche: 'E',
          })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40,
            paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
            border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
            background: sp.accent, color: sp.accentInk, opacity: bloque ? 0.5 : 1, cursor: bloque ? 'not-allowed' : 'pointer',
          }}>
          {/* « Proposé · 2 » ; la phrase entière (« J'ai proposé 2 biens à Julie ») au survol. À zéro, le bouton (désactivé, sa
              raison à côté) ne compte pas. */}
          {coches.length === 0 ? t('fil.actions.propose') : t('fil.selection.propose', { count: coches.length })}
        </button>
      </div>
    </section>
  )
}

function Bien({ sp, m, coche, maintenant, onCocher, onEcarter }: {
  sp: CrmPalette; m: FilMatch; coche: boolean; maintenant: number
  onCocher: (id: string, coche: boolean) => void; onEcarter: (m: FilMatch) => void
}) {
  const { t } = useTranslation('matching')
  const lignes = lignesCriteres(m)
  const aVerifier = criteresNonTenus(lignes)
  const signal = signalBien(m.bien, maintenant)
  // La baisse depuis la proposition à CET acheteur (lot B), sinon celle de l'annonce (lot C) ; un bien neuf, sa pastille
  // — qui cède à une baisse, comme sur la carte focus et dans la liste.
  const baisse = baisseDuMatch(m, t) ?? (signal ? baisseDuBien(signal, m.bien, t) : null)
  const nouveau = signal && !baisse ? texteSignalBien(signal, m.bien, t, true) : null
  // Même ordre que `baisse`, le match d'abord : « Refusé par … à CHF … » (lot B), « … dernière baisse le … » (lot C).
  const phraseBaisse = baisse ? texteSignalMatch(m, t, maintenant) : null
  // Aucun verdict du tout : le dire tel quel plutôt que lister chaque critère « à vérifier ».
  const nonEvalues = lignes.length > 0 && lignes.every((l) => l.ok === null)
  // Sans écart, rien : l'alerte ne se lit que là où il y en a une.
  const resume = lignes.length === 0 ? t('fil.sansCriteres')
    : aVerifier.length === 0 ? null
      : nonEvalues ? t('fil.nonEvalues')
        : t('fil.selection.ecarts', { liste: aVerifier.map((c) => t(`fil.criteres.${c}`)).join(', ') })
  const alerte = lignes.length > 0 && !nonEvalues && aVerifier.length > 0
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {prixBien(m.bien, t)}
            {baisse && <FilBaisse sp={sp} montant={baisse} libelle={phraseBaisse} />}
            {nouveau && <FilNouveau sp={sp} libelle={nouveau} />}
            {/* Un écart se dit par l'alerte ambre ; sa liste au survol et pour un lecteur d'écran. Sans verdict ou sans
                critère, rien n'est en écart : un « ? » en sourdine dit pourquoi le bien reste décoché. Une autre FORME,
                pas seulement une autre teinte — en clair, l'ambre et la sourdine ont presque la même luminance (1,1:1). */}
            {resume && (
              <span title={resume} style={{ display: 'inline-flex', flex: 'none' }}>
                <span aria-hidden style={{ display: 'inline-flex' }}>
                  <MEIcon name={alerte ? 'alert' : 'help'} size={12} color={alerte ? teinteEcart(sp) : sp.sub} />
                </span>
                <span className="sr-only">{resume}</span>
              </span>
            )}
          </span>
        </span>
      </label>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
      {/* La cible fait 24 × 24, le minimum de WCAG 2.5.8 ; la croix garde ses 14 px. */}
      <button type="button" onClick={unSeulClic(() => onEcarter(m))} aria-label={t('fil.selection.ecarterAria', { titre: m.bien.titre })}
        title={t('fil.actions.ecarter')} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 24, height: 24, padding: 0,
          border: 0, background: 'transparent', cursor: 'pointer',
        }}>
        <MEIcon name="close" size={14} color={sp.sub} />
      </button>
    </li>
  )
}
