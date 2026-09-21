/**
 * La liste du fil (§3.2) : « Vos biens », un groupe par bien et ses acheteurs dessous ; puis
 * « Marché », une ligne par acheteur (lot 2) ; puis les reportés, repliés.
 *
 * ⚠ Une ligne est un `role="option"` à tabindex ITINÉRANT : seule la ligne courante est dans l'ordre
 * de tabulation, et ↑/↓ déplacent la sélection — c'est `MatchingFil` qui porte le clavier du fil.
 * La liste entière n'est donc qu'un arrêt de Tab.
 *
 * ⚠ L'en-tête d'un bien est MASQUÉ aux lecteurs d'écran : un `listbox` ne contient que des options et
 * des groupes, et le groupe porte déjà le titre du bien en libellé.
 */
import { useState, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import {
  cleSelection, initiales, lignesCriteres, palierScore, premierEcart,
  type FilBien, type FilMatch, type FilSelectionResume, type FilVue,
} from './filModele'
import { encreAccent, prixBien, teinteEcart } from './filAffichage'
import { FilAvatar, FilScore, FilVignette } from './filAtomes'

interface Props {
  sp: CrmPalette
  vue: FilVue
  selections: FilSelectionResume[]
  courant: string | null
  onChoisir: (id: string) => void
  onReactiver: (id: string) => void
}

const dateCourte = (iso: string): string => format(new Date(iso), 'dd.MM')

// ⛔ Le second clic d'un double clic tombe sur ce que le premier a fait apparaître ou déplacer sous
// le curseur (une ligne qui glisse, un bouton qui la remplace) : `detail` compte les clics du même
// geste, 2 au second — l'activation clavier, elle, porte `detail: 0` et n'est jamais concernée.
function ignorerDoubleClic<T>(faire: (v: T) => void) {
  return (v: T) => (e: MouseEvent) => { if (e.detail > 1) return; faire(v) }
}

export default function FilListe({ sp, vue, selections, courant, onChoisir, onReactiver }: Props) {
  const { t } = useTranslation('matching')
  const [reportesOuverts, setReportesOuverts] = useState(false)
  const prochainRetour = vue.reportes[0]?.reporteJusquau ?? null
  return (
    <div style={{ padding: 'var(--crm-space-lg)' }}>
      {/* `--fil-fond` suit le fond : l'anneau des vignettes d'une ligne « Marché » en prend la teinte. */}
      <style>{`.fil-ligne:hover { background: ${sp.focusSurface} !important; --fil-fond: ${sp.focusSurface} !important; }`}</style>
      {vue.groupes.length > 0 && (
        <>
          <p style={{ margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {t('fil.vosBiens')}
          </p>
          <div role="listbox" aria-label={t('fil.listeAria')}>
            {vue.groupes.map((g) => (
              <div key={g.bien.id} role="group" aria-label={g.bien.titre} style={{ marginBottom: 'var(--crm-space-md)' }}>
                <EnTeteBien sp={sp} bien={g.bien} nombre={g.matchs.length} />
                {g.matchs.map((m) => <Ligne key={m.id} sp={sp} m={m} active={m.id === courant} onChoisir={onChoisir} />)}
              </div>
            ))}
          </div>
        </>
      )}
      {selections.length > 0 && (
        <>
          <p style={{ margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {t('fil.marche')}
          </p>
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
              <button type="button" onClick={ignorerDoubleClic(onReactiver)(m.id)} style={{
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

/** Une ligne du fil — match ou sélection — choisie ou non. */
function styleLigne(sp: CrmPalette, active: boolean): CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'left',
    padding: 'var(--crm-space-sm) var(--crm-space-lg)', border: 0, borderRadius: 'var(--crm-radius-md)',
    cursor: 'pointer', fontFamily: 'inherit', color: sp.ink,
    background: active ? sp.focusSurface : 'transparent',
    // Le fond RÉEL de la ligne (transparente, elle montre celui de la colonne) : la règle `:hover` le
    // reprend, et l'anneau des vignettes empilées le lit.
    ['--fil-fond' as string]: active ? sp.focusSurface : sp.frameBg,
    // L'élément ACTIF porte l'accent (CLAUDE.md §3), en filet : sur sombre l'accent brut tombe sous 3:1.
    boxShadow: active ? `inset 0 0 0 1px ${encreAccent(sp)}` : 'none',
  }
}

/** La ligne « Marché » d'un acheteur : ses meilleures vignettes, combien de biens attendent, le meilleur score. */
function LigneSelection({ sp, s, active, onChoisir }: { sp: CrmPalette; s: FilSelectionResume; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const cle = cleSelection(s.acheteur.id)
  const vignettes: (string | null)[] = s.vignettes.length > 0 ? s.vignettes.slice(0, 3) : [null]
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={cle}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(cle)} onFocus={() => onChoisir(cle)} style={styleLigne(sp, active)}>
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
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.selection.ligne', { count: s.nombre })}</span>
      </span>
      <FilScore sp={sp} score={s.meilleurScore} palier={palierScore(s.meilleurScore)} />
    </button>
  )
}

function EnTeteBien({ sp, bien, nombre }: { sp: CrmPalette; bien: FilBien; nombre: number }) {
  const { t } = useTranslation('matching')
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
      <FilVignette sp={sp} photo={bien.photo} largeur={40} hauteur={30} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bien.titre}
        </div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {prixBien(bien, t)} · {t('fil.acheteurs', { count: nombre })}
        </div>
      </div>
    </div>
  )
}

function Ligne({ sp, m, active, onChoisir }: { sp: CrmPalette; m: FilMatch; active: boolean; onChoisir: (id: string) => void }) {
  const { t } = useTranslation('matching')
  const lignes = lignesCriteres(m)
  const ecart = premierEcart(lignes)
  const resume = lignes.length === 0 ? t('fil.sansCriteres')
    : ecart ? t('fil.ecartSur', { critere: t(`fil.criteres.${ecart}`) })
      : lignes.some((l) => l.ok === null) ? t('fil.nonEvalues') : t('fil.sansEcart')
  return (
    <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1} data-match={m.id}
      className="fil-ligne" onClick={ignorerDoubleClic(onChoisir)(m.id)} onFocus={() => onChoisir(m.id)} style={styleLigne(sp, active)}>
      <FilAvatar sp={sp} texte={initiales(m.acheteur.prenom, m.acheteur.nom)} taille={28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.acheteur.prenom} {m.acheteur.nom}
        </span>
        {/* ⚠ Le résumé reste à l'encre sourde, l'écart est porté par l'icône : l'ambre en texte tombe
            à 4,29:1 sur la ligne choisie ou survolée, en clair. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {ecart && (
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
