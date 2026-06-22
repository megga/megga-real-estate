// MEGGA CRM — Refonte « Aujourd'hui » · Tuile « Relances IA » (câblée)
// ----------------------------------------------------------------------------
// Visuel porté 1:1 de `today-proto-relances.jsx` ; données CÂBLÉES sur les
// vrais leads dormants (useRelanceLeads). Gros chiffre = nombre réel de leads à
// relancer ; barre de température = répartition par score (chaud/tiède/froid).
// Quand l'agence n'a aucun lead dormant (ou session non authentifiée) on
// retombe sur les valeurs de démo du prototype pour garder l'UX utilisable.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TK } from './tk'
import { RXIcon } from './kit'
import { useRelanceLeads } from '@/hooks/useRelanceLeads'

// Libellés de température : clé i18n stable par seau (le libellé est traduit au
// rendu, cf. § conventions i18n — la donnée reste un code stable).
const SEG_LABEL_KEY: Record<string, string> = {
  chaud: 'today.relances.tempHot',
  tiede: 'today.relances.tempWarm',
  froid: 'today.relances.tempCold',
}

// Valeurs de démo (fallback prototype quand 0 lead réel).
const SEED_TOTAL = 47
const SEED_SEG = [
  { key: 'chaud', count: 8, color: '#E08A45' },
  { key: 'tiede', count: 21, color: '#F2B855' },
  { key: 'froid', count: 18, color: '#6F8CFF' },
] as const

// score (0-100, cf. useRelanceLeads : hot→85 / warm→65 / cold→35 / def→50)
// → seau de température. Couleurs identiques au prototype.
function bucketize(scores: number[]) {
  const chaud = scores.filter((s) => s >= 80).length
  const tiede = scores.filter((s) => s >= 50 && s < 80).length
  const froid = scores.filter((s) => s < 50).length
  return [
    { key: 'chaud', count: chaud, color: '#E08A45' },
    { key: 'tiede', count: tiede, color: '#F2B855' },
    { key: 'froid', count: froid, color: '#6F8CFF' },
  ]
}

export function RelancesTile({ onStart, demo = false }: { onStart: () => void; demo?: boolean }) {
  const { t } = useTranslation('dashboard')
  const [h, setH] = useState(false)
  const { leads } = useRelanceLeads()
  // Agent réel → vrais leads (0 honnête si aucun) ; seed démo seulement derrière `demo`.
  const live = !demo

  const total = live ? leads.length : SEED_TOTAL
  const seg = live ? bucketize(leads.map((l) => l.score)) : SEED_SEG

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        {/* gros chiffre */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <span style={{ fontSize: 60, fontWeight: 800, color: TK.ink, lineHeight: 0.85, letterSpacing: -2.5, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          <div style={{ paddingBottom: 5 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TK.inkDim, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{t('today.relances.leadsToFollow')}</div>
            <div style={{ fontSize: 12, color: TK.sub, fontWeight: 600, whiteSpace: 'nowrap' }}>{t('today.relances.preparedByAi')}</div>
          </div>
        </div>
        {/* barre température */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
            {seg.map((s) => (
              <div key={s.key} title={`${t(SEG_LABEL_KEY[s.key])} · ${s.count}`} style={{ flex: Math.max(s.count, 0.0001), background: s.color }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 9 }}>
            {seg.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
                <span style={{ fontSize: 11.5, color: TK.sub, fontWeight: 600 }}>{t(SEG_LABEL_KEY[s.key])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* CTA session */}
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <button
          onClick={onStart}
          onMouseEnter={() => setH(true)}
          onMouseLeave={() => setH(false)}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%',
            height: 46, borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            fontSize: 14, fontWeight: 800, letterSpacing: -0.1, background: h ? '#fff' : '#F2F2F6', color: '#0A0A0F',
            boxShadow: h ? '0 12px 30px -8px rgba(255,255,255,.25)' : '0 6px 16px -6px rgba(0,0,0,.5)',
            transform: h ? 'translateY(-1px)' : 'none', transition: 'all .18s ease' }}>
          <RXIcon name="bolt" size={17} sw={2.1} />{t('today.relances.startSession')}
        </button>
      </div>
    </div>
  )
}
