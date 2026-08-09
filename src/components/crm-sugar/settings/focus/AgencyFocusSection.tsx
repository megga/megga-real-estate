// MEGGA CRM — Section « Mon agence » façon Focus (grammaire du profil).
// Rendue dans le bento droit des Réglages quand active === 'agency'.
// Bande info + header (logo + nom) + groupes éditables en ligne (kit pfKit).
// Câblage : agencies via useAgencySettings ; logo via bucket Storage `agency-logos`.
// Le nom d'agence s'affiche en header (défini à l'onboarding) — non édité ici,
// conformément au design. Les objectifs commerciaux vivent dans Analytics.

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { useAgencySettings, type AgencySettingsData } from '@/hooks/useAgencySettings'
import { useLegalForms } from '@/hooks/useLegalForms'
import { PfIc, PfEditField, type FocusSectionProps, type PfRow, type PfColors, type PfEditLabels } from './pfKit'
import { pfColors, PF_KEYFRAMES } from './pfKitCore'

type RowKey =
  | 'legal' | 'legalFormId' | 'businessRegistrationNumber' | 'tva'
  | 'address' | 'postal' | 'city' | 'canton' | 'phone' | 'email' | 'website'
  | 'aboutShort'

interface RowDef {
  key: RowKey
  icon: PfRow['icon']
  labelKey?: string
  multiline?: boolean
  placeholderKey?: string
  /** Ligne à choix unique alimentée par un référentiel (au lieu d'une saisie libre). */
  optionsSource?: 'legalForms'
}
interface GroupDef { id: 'legal' | 'coord' | 'presentation'; dotKey: 'blue' | 'cyan' | 'orange'; rows: RowDef[] }

const AG_GROUPS: GroupDef[] = [
  { id: 'legal', dotKey: 'blue', rows: [
    { key: 'legal', icon: 'building' },
    // Libellé inchangé (« Forme juridique ») : c'est la valeur qui passe d'un texte
    // libre à une FK, pas le concept.
    { key: 'legalFormId', icon: 'scale', labelKey: 'legalForm', optionsSource: 'legalForms' },
    { key: 'businessRegistrationNumber', icon: 'hash' },
    { key: 'tva', icon: 'receipt' },
  ] },
  { id: 'coord', dotKey: 'cyan', rows: [
    { key: 'address', icon: 'mapPin' },
    { key: 'postal', icon: 'mapPin' },
    { key: 'city', icon: 'building' },
    { key: 'canton', icon: 'mapPin' },
    { key: 'phone', icon: 'phone' },
    { key: 'email', icon: 'mail' },
    { key: 'website', icon: 'globe' },
  ] },
  { id: 'presentation', dotKey: 'orange', rows: [
    { key: 'aboutShort', icon: 'globe', labelKey: 'about', multiline: true },
  ] },
]

/** Les quatre champs que les VÉTOS d'entité comparent au registre du commerce, donc ceux que
 *  le garde serveur gèle (agencies_guard_identity_columns, 20260731130000). `address` et ses
 *  voisines n'y sont pas : elles ne nourrissent qu'address_geocode, un signal scorable. */
const LEGAL_IDENTITY_KEYS: RowKey[] = ['legal', 'legalFormId', 'businessRegistrationNumber', 'tva']

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'AG'
  return ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'AG'
}

// Upload du logo vers `agency-logos` (path {agencyId}/logo.png). Renvoie l'URL
// publique cache-bustée, ou null (l'appelant garde alors la valeur courante).
async function uploadAgencyLogo(dataUrl: string, agencyId: string): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const path = `${agencyId}/logo.png`
    const { error } = await supabase.storage.from('agency-logos').upload(path, blob, { upsert: true, contentType: 'image/png', cacheControl: '3600' })
    if (error) { console.error('[AgencyFocus] logo upload failed', error); return null }
    const { data } = supabase.storage.from('agency-logos').getPublicUrl(path)
    if (!data?.publicUrl) return null
    return `${data.publicUrl}?v=${Date.now()}`
  } catch (err) {
    console.error('[AgencyFocus] logo upload threw', err)
    return null
  }
}

function AgLogoTile({ c, url, initials, size = 62 }: { c: PfColors; url: string; initials: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--crm-radius-3xl)', flexShrink: 0, overflow: 'hidden', boxShadow: '0 10px 26px -12px rgba(11,12,14,0.45)',
      background: url ? `#0B0C0E center/cover no-repeat url("${url}")` : c.ink, color: c.dark ? '#0B0C0E' : '#fff', display: 'grid', placeItems: 'center', fontSize: size * 0.34, fontWeight: 800, letterSpacing: -0.5 }}>
      {url ? null : initials}
    </div>
  )
}

export function AgencyFocusSection({ sp, surf, dark }: FocusSectionProps) {
  const { t } = useTranslation('settings')
  const c: PfColors = pfColors(sp, surf, dark)
  const toast = useToast()
  const { agency, hasBackend, agencyId, save, legalIdentityLock } = useAgencySettings()

  const [local, setLocal] = useState<AgencySettingsData>(agency)
  useEffect(() => { setLocal(agency) }, [agency])

  // Les formes juridiques dépendent du pays du siège : changer `country` change la liste.
  const { options: legalFormOptions } = useLegalForms(local.country)

  const [editKey, setEditKey] = useState<RowKey | null>(null)
  const [savedKey, setSavedKey] = useState<RowKey | null>(null)
  const [draft, setDraft] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const editLabels: PfEditLabels = useMemo(() => ({
    saved: t('focus.common.saved'), add: t('focus.common.add'), edit: t('focus.common.edit'),
    toFill: t('focus.common.toFill'), cancel: t('focus.common.cancel'), save: t('focus.common.save'),
  }), [t])

  const startEdit = (key: RowKey) => { setEditKey(key); setDraft(local[key] ?? '') }

  // Renvoie true si la persistance a réussi. `key` optionnelle : la badge
  // « Enregistré » ne s'affiche que sur une ligne éditée (pas pour le logo).
  const persist = async (next: AgencySettingsData, key?: RowKey): Promise<boolean> => {
    setLocal(next)
    if (!hasBackend) { toast.error(t('focus.toast.agencyNotLoaded')); return false }
    try {
      await save(next)
      if (key) {
        setSavedKey(key)
        setTimeout(() => setSavedKey((s) => (s === key ? null : s)), 1600)
      }
      return true
    } catch {
      toast.error(t('focus.toast.saveError'))
      return false
    }
  }

  const saveField = async () => {
    const key = editKey
    if (!key) return
    setEditKey(null)
    await persist({ ...local, [key]: draft.trim() }, key)
  }

  const onLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!agencyId) { toast.error(t('focus.toast.agencyNotLoaded')); return }
    const dataUrl: string = await new Promise((res, rej) => {
      const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.onerror = rej; rd.readAsDataURL(f)
    })
    const url = await uploadAgencyLogo(dataUrl, agencyId)
    if (!url) { toast.error(t('focus.toast.logoUploadError')); return }
    // Pas de clé de ligne → aucune badge « Enregistré » parasite ; succès seulement si persisté.
    const ok = await persist({ ...local, logoUrl: url })
    if (ok) toast.success(t('focus.agency.logoUpdated'))
  }

  const toRow = (r: RowDef): PfRow => {
    // Verrou d'identité légale (étape 7, tâche 3) : les quatre champs que les vétos d'entité
    // comparent au registre passent en lecture seule quand le garde serveur les refuserait
    // (agencies_guard_identity_columns, 20260731130000). Sans cela l'utilisateur voit
    // « Modifier », saisit, enregistre, et reçoit un 42501 opaque. Le cadenas de pfKit porte
    // déjà l'affordance et son infobulle : aucun composant à inventer.
    const locked = LEGAL_IDENTITY_KEYS.includes(r.key) && legalIdentityLock !== null
    return {
      key: r.key, icon: r.icon, label: t(`focus.agency.fields.${r.labelKey ?? r.key}`),
      multiline: r.multiline,
      options: r.optionsSource === 'legalForms' ? legalFormOptions : undefined,
      placeholder: r.placeholderKey ? t(`focus.agency.${r.placeholderKey}`) : undefined,
      locked,
      hint: locked ? t(`focus.agency.identityLocked.${legalIdentityLock}`) : undefined,
    }
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
      <style>{`
        ${PF_KEYFRAMES}
        .pfx-row { transition: background-color .24s ease; }
        .pfx-row:hover { background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'}; }
        .pfx-inp:focus { box-shadow: 0 0 0 2px ${c.ink} inset !important; }
        .pfx-inp::placeholder { color: ${c.ghost}; }
      `}</style>

      <input ref={fileRef} type="file" accept="image/*" onChange={onLogoFile} style={{ display: 'none' }} />

      <div style={{ borderRadius: 'var(--crm-radius-5xl)', boxShadow: c.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', background: c.cardSub, borderRadius: '22px 22px 0 0', border: c.hair, borderBottom: `1px solid ${c.hairSoft}`, padding: 'var(--crm-space-md) var(--crm-space-5xl)' }}>
          <PfIc name="info" size={14} stroke={c.sub} sw={1.8} />
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: c.sub, letterSpacing: -0.1 }}>{t('focus.agency.banner')}</span>
        </div>

        <div style={{ position: 'relative', background: c.card, borderRadius: '0 0 22px 22px', border: c.hair, borderTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl)' }}>
            <button onClick={() => fileRef.current?.click()} title={t('focus.agency.header')} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', position: 'relative' }}>
              <AgLogoTile c={c} url={local.logoUrl} initials={initialsOf(local.name)} size={62} />
              <span style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 'var(--crm-radius-pill)', background: c.affordance.bg, border: `3px solid ${c.card}`, display: 'grid', placeItems: 'center' }}>
                <PfIc name={local.logoUrl ? 'camera' : 'plus'} size={12} stroke={c.affordance.ink} sw={2.2} />
              </span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 800, letterSpacing: -0.6, color: c.ink, lineHeight: 1.05 }}>{local.name || t('focus.agency.header')}</div>
            </div>
          </div>

          <div style={{ height: 1, background: c.hairSoft, margin: '0 10px' }} />

          <div style={{ padding: 'var(--crm-space-md) var(--crm-space-xl) var(--crm-space-2xl)' }}>
            {AG_GROUPS.map((g, gi) => (
              <div key={g.id} style={{ padding: 'var(--crm-space-sm) 0 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-xl) var(--crm-space-lg) var(--crm-space-md)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: c[g.dotKey], flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 800, letterSpacing: 0.2, color: c.ink, flex: 1 }}>{t(`focus.agency.groups.${g.id}`)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
                  {g.rows.map((r) => (
                    <div key={r.key} style={{ gridColumn: r.multiline ? '1 / -1' : 'auto', minWidth: 0 }}>
                      <PfEditField c={c} row={toRow(r)} value={local[r.key] ?? ''} editing={editKey === r.key} saved={savedKey === r.key}
                        draft={draft} setDraft={setDraft} labels={editLabels}
                        onEdit={() => startEdit(r.key)} onSave={saveField} onCancel={() => setEditKey(null)} />
                    </div>
                  ))}
                </div>
                {gi < AG_GROUPS.length - 1 && <div style={{ height: 1, background: c.hairSoft, margin: '12px 12px 0' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
