/**
 * « Nouveau bien » · étape 3 — L'annonce : titre, description, atouts.
 *
 * Le titre est PROPOSÉ (« Appartement 4,5 pièces · Genève ») et reste modifiable ; vide,
 * c'est la proposition qui est enregistrée. La description peut être rédigée par MEGGA AI
 * (`genererDescriptionIA`, partagée avec l'ancien wizard) — une ASSISTANCE : l'écran le
 * dit, et l'agent relit avant de publier.
 *
 * Les atouts gardent les CLÉS de l'ancien wizard (`balcon`, `vue_lac`, `custom:…`) : les
 * deux parcours écrivent la même colonne, et la fiche les lit de la même façon.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { WizardData } from '@/components/crm-wizard/tokens'
import { genererDescriptionIA } from '@/components/crm-wizard/descriptionIA'
import { NbBloc, NbPuce } from './atomes'
import { DESCRIPTION_MIN } from './completude'

/** Les atouts les plus demandés d'abord ; le reste derrière « Voir tous les atouts ». */
const ATOUTS_COURANTS = ['balcon', 'terrasse', 'jardin', 'vue_lac', 'ascenseur', 'parking', 'garage', 'cave', 'cuisine_agencee', 'piscine', 'cheminee', 'meuble']
const ATOUTS_AUTRES = ['vue', 'buanderie', 'clim', 'dressing', 'parquet', 'reduit', 'cave_a_vin', 'pompe_chaleur', 'solaire', 'borne_recharge', 'domotique', 'fibre', 'triple_vitrage', 'abri_pc', 'velo', 'conciergerie', 'plain_pied', 'mansarde', 'accessible_pmr', 'animaux']

/** La consigne envoyée à MEGGA AI pour chaque ton — le texte du modèle, pas de l'écran. */
const CONSIGNES: Record<NonNullable<WizardData['descTone']>, string> = {
  neutre: 'ton neutre et factuel',
  premium: 'ton haut de gamme et élégant, sans superlatifs creux',
  famille: 'mettre en avant la vie de famille : espaces, écoles, calme',
  invest: "mettre en avant le potentiel d'investissement : rendement, emplacement, état",
}

export function EtapeAnnonce({ data, set, titreSuggere, sp }: {
  data: WizardData; set: (p: Partial<WizardData>) => void; titreSuggere: string; sp: CrmPalette
}) {
  const { t } = useTranslation('listings')
  const [ia, setIa] = useState<'repos' | 'redaction' | 'echec'>('repos')
  const [tousAtouts, setTousAtouts] = useState(false)
  const [atoutLibre, setAtoutLibre] = useState('')
  const ton = data.descTone ?? 'neutre'
  const features = data.features
  const longueur = data.description.trim().length

  const rediger = async () => {
    if (ia === 'redaction') return
    setIa('redaction')
    try {
      const texte = await genererDescriptionIA(data, CONSIGNES[ton])
      set({ description: texte, aiAssist: true })
      setIa('repos')
    } catch {
      setIa('echec')
    }
  }
  const basculer = (cle: string) => set({ features: features.includes(cle) ? features.filter((f) => f !== cle) : [...features, cle] })
  const ajouterLibre = () => {
    const v = atoutLibre.trim()
    if (v && !features.includes(`custom:${v}`)) set({ features: [...features, `custom:${v}`] })
    setAtoutLibre('')
  }
  const libres = features.filter((f) => f.startsWith('custom:'))

  // Deux colonnes : le texte à gauche (titre, description), les atouts à droite.
  return (
    <>
      <div className="nb-col">
        <NbBloc sp={sp} titre={t('nouveauBien.annonce.titre')}>
          <label className="nb-champ" style={{ display: 'flex', alignItems: 'center', height: 48, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg }}>
            <input value={data.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={titreSuggere} aria-label={t('nouveauBien.annonce.titre')}
              style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }} />
          </label>
        </NbBloc>

        <NbBloc sp={sp} titre={t('nouveauBien.annonce.description')}>
          {/* MEGGA AI : le ton, puis « Rédiger » — au-dessus du texte qu'il remplira. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap', padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: sp.focusSurface }}>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, marginRight: 'var(--crm-space-xs)' }}>{t('nouveauBien.annonce.iaTon')}</span>
            {(Object.keys(CONSIGNES) as NonNullable<WizardData['descTone']>[]).map((k) => (
              <NbPuce key={k} sp={sp} on={ton === k} onClick={() => set({ descTone: k })}>{t(`nouveauBien.annonce.tons.${k}`)}</NbPuce>
            ))}
            {/* `marginLeft: auto` et non un espaceur : si la barre passe à la ligne, le bouton reste à droite. */}
            <button type="button" onClick={() => void rediger()} disabled={ia === 'redaction'} style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 38, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)',
              border: 0, background: sp.accent, color: sp.accentInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: ia === 'redaction' ? 'wait' : 'pointer', opacity: ia === 'redaction' ? 0.7 : 1,
            }}>
              {ia === 'redaction' ? t('nouveauBien.annonce.iaEnCours') : data.description.trim() ? t('nouveauBien.annonce.iaReecrire') : t('nouveauBien.annonce.iaRediger')}
            </button>
          </div>
          {ia === 'echec' && <div role="alert" style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>{t('nouveauBien.annonce.iaEchec')}</div>}
          <textarea value={data.description} onChange={(e) => set({ description: e.target.value, aiAssist: false })} placeholder={t('nouveauBien.annonce.descriptionPlaceholder')}
            aria-label={t('nouveauBien.annonce.description')} rows={9} className="nb-champ"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 220, padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg, color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: longueur >= DESCRIPTION_MIN ? sp.ink : sp.sub }}>
              {t('nouveauBien.annonce.caracteres', { count: longueur, min: DESCRIPTION_MIN })}
            </span>
            {data.aiAssist && <span>· {t('nouveauBien.annonce.iaRelire')}</span>}
          </div>
        </NbBloc>
      </div>

      <div className="nb-col">
        <NbBloc sp={sp} titre={t('nouveauBien.annonce.atouts')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xs)' }}>
            {[...ATOUTS_COURANTS, ...(tousAtouts ? ATOUTS_AUTRES : [])].map((cle) => (
              <NbPuce key={cle} sp={sp} on={features.includes(cle)} onClick={() => basculer(cle)}>{t(`wizard.step3.feature.${cle}`)}</NbPuce>
            ))}
            {libres.map((f) => (
              <NbPuce key={f} sp={sp} on onClick={() => basculer(f)}>{f.slice(7)}</NbPuce>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
            {!tousAtouts && (
              <button type="button" onClick={() => setTousAtouts(true)} style={{ border: 0, background: 'transparent', padding: 0, color: sp.accent, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer' }}>
                {t('nouveauBien.annonce.tousAtouts', { count: ATOUTS_AUTRES.length })}
              </button>
            )}
            <label className="nb-champ" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 38, padding: '0 var(--crm-space-xs) 0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg }}>
              <input value={atoutLibre} onChange={(e) => setAtoutLibre(e.target.value)} placeholder={t('wizard.step3.customPlaceholder')} aria-label={t('wizard.step3.addFeature')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ajouterLibre() } }}
                style={{ width: 180, border: 0, outline: 'none', background: 'transparent', color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)' }} />
              <button type="button" onClick={ajouterLibre} aria-label={t('wizard.step3.addFeature')} style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, background: sp.focusSurface, color: sp.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <MEIcon name="plus" size={13} />
              </button>
            </label>
          </div>
        </NbBloc>
      </div>
    </>
  )
}
