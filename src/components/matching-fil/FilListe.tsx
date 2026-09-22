/**
 * La liste « À proposer » du fil (§3.2) : les recherches à ajuster (« Apprendre », lot B), puis « Vos
 * biens », un groupe par bien et ses acheteurs dessous ; puis « Marché », une ligne par acheteur (lot 2) ;
 * puis les reportés, repliés.
 *
 * ⚠ Une ligne est un `role="option"` à tabindex ITINÉRANT : seule la ligne courante est dans l'ordre
 * de tabulation, et ↑/↓ déplacent la sélection — c'est `MatchingFil` qui porte le clavier du fil.
 * La liste entière n'est donc qu'un arrêt de Tab.
 *
 * ⚠ L'en-tête d'un bien est une LIGNE depuis le lot C (`cleBien`) : choisie, elle ouvre « Qui pour ce bien ? ».
 * Une `option` dans le groupe du bien — un `listbox` ne contient que des options et des groupes. Il porte le
 * signal « nouveau mandat ».
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse porte, à la place de ses écarts, « Prix baissé de
 * … » : c'est ce qui le ramène, donc ce qui le fait proposer (le panneau dit le reste). Le survol des lignes
 * (`.fil-ligne`) est posé par `MatchingFil` (`FilStyleLignes`), commun aux trois onglets.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import {
  cleBien, cleSelection, initiales, lignesCriteres, palierScore, premierEcart,
  type FilBien, type FilMatch, type FilSelectionResume, type FilVue,
} from './filModele'
import type { Correction } from './filApprendre'
import { dateCourte, encreAccent, prixBien, styleLigne, teinteEcart, texteSignal, texteSignalBien, unSeulClic } from './filAffichage'
import { signalBien } from './filSignaux'
import { FilAvatar, FilScore, FilVignette } from './filAtomes'

interface Props {
  sp: CrmPalette
  vue: FilVue
  selections: FilSelectionResume[]
  corrections: Correction[]
  courant: string | null
  onChoisir: (id: string) => void
  onReactiver: (id: string) => void
  /** L'heure de la lecture : le signal « nouveau mandat » s'y mesure (lot C). */
  maintenant: number
}

export default function FilListe({ sp, vue, selections, corrections, courant, onChoisir, onReactiver, maintenant }: Props) {
  const { t } = useTranslation('matching')
  const [reportesOuverts, setReportesOuverts] = useState(false)
  const prochainRetour = vue.reportes[0]?.reporteJusquau ?? null
  const titreSection = { margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }
  return (
    <div style={{ padding: 'var(--crm-space-lg)' }}>
      {corrections.length > 0 && (
        <>
          <p style={titreSection}>{t('fil.corrections.section')}</p>
          <div role="listbox" aria-label={t('fil.corrections.listeAria')} style={{ marginBottom: 'var(--crm-space-md)' }}>
            {corrections.map((c) => (
              <LigneCorrection key={c.cle} sp={sp} c={c} active={c.cle === courant} onChoisir={onChoisir} />
            ))}
          </div>
        </>
      )}
      {vue.groupes.length > 0 && (
        <>
          <p style={titreSection}>{t('fil.vosBiens')}</p>
          <div role="listbox" aria-label={t('fil.listeAria')}>
            {vue.groupes.map((g) => (
              <div key={g.bien.id} role="group" aria-label={g.bien.titre} style={{ marginBottom: 'var(--crm-space-md)' }}>
                <EnTeteBien sp={sp} bien={g.bien} nombre={g.matchs.length} maintenant={maintenant}
                  active={cleBien(g.bien.id) === courant} onChoisir={onChoisir} />
                {g.matchs.map((m) => <Ligne key={m.id} sp={sp} m={m} active={m.id === courant} onChoisir={onChoisir} />)}
              </div>
            ))}
          </div>
        </>
      )}
      {selections.length > 0 && (
        <>
          <p style={titreSection}>{t('fil.marche')}</p>
          <div role="listbox" aria-label={t('fil.marcheAria')} style={{ marginBottom: 'var(--crm-space-md)' }}>
            {selections.map((s) => (
              <LigneSelection key={s.acheteur.id} sp={sp} s={s} active={cleSelection(s.acheteur.id) === courant} onChoisir={onChoisir} />
            ))}
          </div>
        </>
      )}
      {vue.reportes.length > 0 && prochainRetour && (
        <div style={{ marginTop: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-md)', borderTop: `1px solid ${sp.cardBorder}` }}>
          <button type="button" aria-expanded={reportesOuverts} onClick={() => setReportesOuverts((v) => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', width: '100%', border: 0, background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', color: sp.sub, textAlign: 'left',
            padding: 'var(--crm-space-sm) var(--crm-space-lg)',
          }}>
            <MEIcon name={reportesOuverts ? 'chevron-up' : 'chevron-down'} size={14} color={sp.sub} />
            {t('fil.reportes', { count: vue.reportes.length, date: dateCourte(prochainRetour) })}
          </button>
          {reportesOuverts && vue.reportes.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
              <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={24} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.ink }}>{m.acheteur.prenom} {m.acheteur.nom}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.bien.titre} · {t('fil.deRetour', { date: dateCourte(m.reporteJusquau as string) })}
                </div>
              </div>
              <button type="button" onClick={unSeulClic(() => onReactiver(m.id))} style={{
                border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp), padding: 'var(--crm-space-xs) var(--crm-space-sm)',
              }}>
                {t('fil.reactiver')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Une correction de recherche proposée par « Apprendre » : l'acheteur, le motif, le nombre de refus. */
function LigneCorrection({ sp, c, active, onChoisir }: { sp: CrmPalette; c: Correction; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={c.cle}
      className="fil-ligne" onClick={unSeulClic(() => onChoisir(c.cle))} onFocus={() => onChoisir(c.cle)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(c.acheteur.prenom, c.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.acheteur.prenom} {c.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {t('fil.corrections.ligne', { motif: t(`fil.motifs.${c.motif}`), count: c.refus.length })}
        </span>
      </span>
    </button>
  )
}

/** La ligne « Marché » d'un acheteur : ses meilleures vignettes, combien de biens attendent, le meilleur score. */
function LigneSelection({ sp, s, active, onChoisir }: { sp: CrmPalette; s: FilSelectionResume; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const cle = cleSelection(s.acheteur.id)
  const vignettes: (string | null)[] = s.vignettes.length > 0 ? s.vignettes.slice(0, 3) : [null]
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      className="fil-ligne" onClick={unSeulClic(() => onChoisir(cle))} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
      <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
        {vignettes.map((url, i) => (
          <span key={`${i}-${url ?? 'vide'}`} style={{
            display: 'inline-flex', marginLeft: i === 0 ? 0 : 'calc(var(--crm-space-md) * -1)',
            // ⚠ L'anneau détache chaque vignette de la précédente : peint au fond de la colonne, il
            // dessinait un cadre d'une autre teinte sur la ligne choisie ou survolée.
            borderRadius: 'var(--crm-radius-xs)', boxShadow: '0 0 0 2px var(--fil-fond)',
          }}>
            <FilVignette sp={sp} photo={url} largeur={28} hauteur={28} />
          </span>
        ))}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.acheteur.prenom} {s.acheteur.nom}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {[
            t('fil.selection.ligne', { count: s.nombre }),
            s.baisses ? t('fil.selection.baisses', { count: s.baisses }) : null,
            s.nouveaux ? t('fil.selection.nouveaux', { count: s.nouveaux }) : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </span>
      <FilScore sp={sp} score={s.meilleurScore} palier={palierScore(s.meilleurScore)} />
    </button>
  )
}

/** L'en-tête d'un bien : une ligne du fil qui ouvre « Qui pour ce bien ? » (lot C), avec son signal « nouveau mandat ». */
function EnTeteBien({ sp, bien, nombre, maintenant, active, onChoisir }: {
  sp: CrmPalette; bien: FilBien; nombre: number; maintenant: number; active: boolean; onChoisir: (id: string) => void
}) {
  const { t } = useTranslation('matching')
  const cle = cleBien(bien.id)
  const signal = signalBien(bien, maintenant)
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      aria-label={t('fil.quiPour.ligneAria', { titre: bien.titre, count: nombre })}
      className="fil-ligne" onClick={unSeulClic(() => onChoisir(cle))} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
      <FilVignette sp={sp} photo={bien.photo} largeur={40} hauteur={30} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bien.titre}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {/* La forme COURTE sur la ligne (« Nouveau mandat ») ; la date est dans le panneau. */}
          {[prixBien(bien, t), t('fil.acheteurs', { count: nombre }), signal ? texteSignalBien(signal, bien, t, true) : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      {/* ⚠ L'invite ne s'écrit que sur l'en-tête CHOISI : écrite sur chacun, elle coupait le sous-titre, et avec lui le
          signal « Nouveau mandat » — le « pourquoi maintenant » qu'on veut lire. Ailleurs, la flèche seule. */}
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flex: 'none', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: encreAccent(sp) }}>
        {active && t('fil.quiPour.titre')}<MEIcon name="arrow-right" size={12} color={active ? encreAccent(sp) : sp.sub} />
      </span>
    </button>
  )
}

function Ligne({ sp, m, active, onChoisir }: { sp: CrmPalette; m: FilMatch; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const lignes = lignesCriteres(m)
  const ecart = premierEcart(lignes)
  const signal = texteSignal(m, t, true)
  const resume = signal ?? (lignes.length === 0 ? t('fil.sansCriteres')
    : ecart ? t('fil.ecartSur', { critere: t(`fil.criteres.${ecart}`) })
      : lignes.some((l) => l.ok === null) ? t('fil.nonEvalues') : t('fil.sansEcart'))
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={m.id}
      className="fil-ligne" onClick={unSeulClic(() => onChoisir(m.id))} onFocus={() => onChoisir(m.id)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.acheteur.prenom} {m.acheteur.nom}
        </span>
        {/* ⚠ Le résumé reste à l'encre sourde, l'écart est porté par l'icône : l'ambre en texte tombe
            à 4,29:1 sur la ligne choisie ou survolée, en clair. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {ecart && !signal && (
            <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
              <MEIcon name="alert" size={12} color={teinteEcart(sp)} />
            </span>
          )}
          {resume}
        </span>
      </span>
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
    </button>
  )
}
