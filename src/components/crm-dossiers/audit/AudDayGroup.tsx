/**
 * AudDayGroup — un jour du journal d'audit : son en-tête, puis ses lignes dans une carte.
 *
 * L'en-tête est COLLANT : en descendant dans une longue journée, on sait toujours de quel
 * jour on lit les lignes. Il porte le compte du jour et, quand il y en a, ses critiques
 * et ses alertes — ce que les quatre cartes de chiffres disaient en haut de page, là où
 * ça se passe. Les rafales se regroupent ici, jour par jour (`rafales`).
 */
import { useMemo } from 'react'
import i18n from '@/i18n'
import { useCrmDark } from '@/lib/crmDark'
import { crmPalette } from '@/components/crm/tokens'
import { dossierPalette } from '../tokens'
import { AudEventRow } from './AudEventRow'
import { rafales } from './journal'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  libelle: string
  events: AuditEvent[]
  /** Les collègues de l'agence (id → nom). */
  noms?: ReadonlyMap<string, string>
  compacte?: boolean
}

/** Un jour du journal : en-tête collant, puis une carte de lignes. */
export function AudDayGroup({ libelle, events, noms, compacte = false }: Props) {
  const dark = useCrmDark()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const S = useMemo(() => dossierPalette(dark), [dark])
  const lignes = useMemo(() => rafales(events), [events])
  const critiques = events.filter((e) => e.severity === 'critical').length
  const alertes = events.filter((e) => e.severity === 'warn').length

  const repere = (n: number, couleur: string, cle: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 'var(--crm-radius-pill)', background: couleur }} />
      {i18n.t(cle, { count: n })}
    </span>
  )

  return (
    <section aria-label={libelle}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 'var(--crm-space-lg)', rowGap: 'var(--crm-space-2xs)',
        padding: 'var(--crm-space-lg) var(--crm-space-2xs) var(--crm-space-md)',
        background: sp.pageBg,
      }}>
        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, letterSpacing: '-0.01em' }}>{libelle}</h2>
        <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
          {i18n.t('common:audit.eventCount', { count: events.length })}
        </span>
        {critiques > 0 && repere(critiques, S.err, 'common:audit.dayCritical')}
        {alertes > 0 && repere(alertes, S.warn, 'common:audit.dayWarning')}
      </header>
      <div style={{
        background: sp.cardBg,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 'var(--crm-radius-4xl)',
        boxShadow: sp.shadowSm,
        overflow: 'hidden',
      }}>
        {lignes.map((l, i) => (
          <AudEventRow
            key={l.tete.id}
            event={l.tete}
            rafale={l.events.length > 1 ? l.events : undefined}
            last={i === lignes.length - 1}
            noms={noms}
            compacte={compacte}
          />
        ))}
      </div>
    </section>
  )
}
