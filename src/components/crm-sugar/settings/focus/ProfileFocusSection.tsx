// MEGGA CRM — Section « Mon profil » façon Focus (câblée dans les Réglages).
// Rendue dans le bento droit du shell Réglages quand active === 'profile'.
// Header (avatar + nom) + groupes éditables en ligne (kit pfKit). Édition immédiate :
// chaque champ enregistré appelle useAgentProfileSugar.save (persistance réelle).
// Câblage : profiles + agent_profiles (via useAgentProfileSugar) ; photo via useAvatar
// (bucket `avatars` + profiles.avatar_url). i18n : namespace `settings` (focus.*).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import { useAgentProfileSugar } from '@/hooks/useAgentProfileSugar'
import { useAvatar } from '@/hooks/useAvatar'
import type { ProfileData } from '../data'
import { PfIc, PfEditField, PfAvatar, PfPhotoModal, type FocusSectionProps, type PfRow, type PfColors, type PfEditLabels } from './pfKit'
import { pfColors, PF_KEYFRAMES } from './pfKitCore'

// Clés éditables = clés string de ProfileData rendues par la section.
type RowKey =
  | 'firstName' | 'lastName' | 'title' | 'email' | 'mobile' | 'phone' | 'agency'
  | 'bio' | 'languages' | 'specialties' | 'website' | 'linkedin'

// Champs stockés UNIQUEMENT dans agent_profiles (pas de repli sur profiles) :
// ne persistent que si la fiche annuaire existe (cf. useAgentProfileSugar.hasAgentProfile).
const DIRECTORY_KEYS: RowKey[] = ['bio', 'languages', 'specialties', 'website', 'linkedin']

// Squelette des groupes (libellés résolus via i18n au render). `labelKey` par défaut = key.
interface RowDef { key: RowKey; icon: PfRow['icon']; labelKey?: string; multiline?: boolean; chips?: string[]; placeholder?: string; locked?: boolean; hintKey?: string }
interface GroupDef { id: 'identity' | 'contact' | 'presentation' | 'links'; dotKey: 'blue' | 'cyan' | 'orange' | 'green'; rows: RowDef[] }

const LANG_CHIPS = ['Français', 'Anglais', 'Allemand', 'Italien', 'Espagnol', 'Portugais']
const SPEC_CHIPS = ['Résidentiel haut de gamme', 'Mandats exclusifs', 'Appartements', 'Villas', 'PPE', 'Immeubles de rendement', 'Terrains & promotion', 'Commercial']

const PF_GROUPS: GroupDef[] = [
  { id: 'identity', dotKey: 'blue', rows: [
    { key: 'firstName', icon: 'user' },
    { key: 'lastName', icon: 'user' },
    { key: 'title', icon: 'briefcase', labelKey: 'role' },
  ] },
  { id: 'contact', dotKey: 'cyan', rows: [
    { key: 'email', icon: 'mail', locked: true, hintKey: 'emailHint' },
    { key: 'mobile', icon: 'smartphone' },
    { key: 'phone', icon: 'phone' },
    { key: 'agency', icon: 'building', locked: true, hintKey: 'agencyHint' },
  ] },
  { id: 'presentation', dotKey: 'orange', rows: [
    { key: 'bio', icon: 'globe', multiline: true },
    { key: 'languages', icon: 'lang', chips: LANG_CHIPS },
    { key: 'specialties', icon: 'star', chips: SPEC_CHIPS },
  ] },
  { id: 'links', dotKey: 'green', rows: [
    { key: 'website', icon: 'link', placeholder: 'https://…' },
    { key: 'linkedin', icon: 'linkedin', placeholder: 'linkedin.com/in/…' },
  ] },
]

export function ProfileFocusSection({ sp, surf, dark }: FocusSectionProps) {
  const { t } = useTranslation('settings')
  const c: PfColors = pfColors(sp, surf, dark)
  const toast = useToast()
  const { profile, hasBackend, hasAgentProfile, save } = useAgentProfileSugar()
  const { avatarUrl, saveDataUrl } = useAvatar()

  const [local, setLocal] = useState<ProfileData>(profile)
  useEffect(() => { setLocal(profile) }, [profile])

  const [editKey, setEditKey] = useState<RowKey | null>(null)
  const [savedKey, setSavedKey] = useState<RowKey | null>(null)
  const [draft, setDraft] = useState('')
  const [photoModal, setPhotoModal] = useState(false)
  const [info, setInfo] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!info) return
    const onDoc = (e: MouseEvent) => { if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfo(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfo(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [info])

  const editLabels: PfEditLabels = useMemo(() => ({
    saved: t('focus.common.saved'), add: t('focus.common.add'), edit: t('focus.common.edit'),
    toFill: t('focus.common.toFill'), cancel: t('focus.common.cancel'), save: t('focus.common.save'),
  }), [t])
  const photoLabels = useMemo(() => ({
    title: t('focus.photo.title'), choose: t('focus.photo.choose'), change: t('focus.photo.change'),
    cancel: t('focus.common.cancel'), save: t('focus.common.save'),
  }), [t])

  const strVal = (key: RowKey): string => {
    const v = local[key]
    return Array.isArray(v) ? v.join(', ') : (v ?? '')
  }
  const startEdit = (key: RowKey) => { setEditKey(key); setDraft(strVal(key)) }

  const saveField = async () => {
    const key = editKey
    if (!key) return
    if (!hasBackend) { setEditKey(null); toast.error(t('focus.toast.sessionExpired')); return }
    // Champ d'annuaire non persistable tant que la fiche agent_profiles n'existe pas :
    // on ferme l'éditeur SANS appliquer la valeur ni afficher « Enregistré » (le save
    // serait un no-op) — le champ reste vide et un message explique pourquoi.
    if (DIRECTORY_KEYS.includes(key) && !hasAgentProfile) {
      setEditKey(null)
      toast.error(t('focus.toast.directoryMissing'))
      return
    }
    const next: ProfileData = { ...local }
    if (key === 'languages' || key === 'specialties') {
      next[key] = draft.split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      next[key] = draft.trim()
    }
    setLocal(next)
    setEditKey(null)
    try {
      await save(next)
      setSavedKey(key)
      setTimeout(() => setSavedKey((s) => (s === key ? null : s)), 1600)
    } catch {
      toast.error(t('focus.toast.saveError'))
    }
  }

  const onPhotoSave = async (dataUrl: string) => {
    setPhotoModal(false)
    await saveDataUrl(dataUrl)
  }

  const toRow = (r: RowDef): PfRow => ({
    key: r.key, icon: r.icon, label: t(`focus.profile.fields.${r.labelKey ?? r.key}`),
    multiline: r.multiline, chips: r.chips, placeholder: r.placeholder, locked: r.locked,
    hint: r.hintKey ? t(`focus.profile.${r.hintKey}`) : undefined,
  })

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
      <style>{`
        ${PF_KEYFRAMES}
        .pfx-row { transition: background-color .24s ease; }
        .pfx-row:hover { background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'}; }
        .pfx-inp:focus { box-shadow: 0 0 0 2px ${c.ink} inset !important; }
        .pfx-inp::placeholder { color: ${c.ghost}; }
      `}</style>

      <div style={{ borderRadius: 'var(--crm-radius-5xl)', boxShadow: c.shadow }}>
        <div style={{ position: 'relative', background: c.card, borderRadius: 'var(--crm-radius-5xl)', border: c.hair }}>

          {/* En-tête : avatar + nom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl)' }}>
            <button onClick={() => setPhotoModal(true)} title={photoLabels.title} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', position: 'relative' }}>
              <PfAvatar c={c} photo={avatarUrl} initials={local.initials || '?'} size={62} />
              <span style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 'var(--crm-radius-pill)', background: c.orange, border: `3px solid ${c.card}`, display: 'grid', placeItems: 'center' }}>
                <PfIc name={avatarUrl ? 'camera' : 'plus'} size={12} stroke="#fff" sw={2.2} />
              </span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 800, letterSpacing: -0.6, color: c.ink, lineHeight: 1.05 }}>
                {(`${local.firstName} ${local.lastName}`).trim() || t('focus.profile.header')}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: c.hairSoft, margin: '0 10px' }} />

          {/* Champs groupés (2 colonnes) */}
          <div style={{ padding: 'var(--crm-space-md) var(--crm-space-xl) var(--crm-space-2xl)' }}>
            {PF_GROUPS.map((g, gi) => (
              <div key={g.id} style={{ padding: 'var(--crm-space-sm) 0 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-xl) var(--crm-space-lg) var(--crm-space-md)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: c[g.dotKey], flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 800, letterSpacing: 0.2, color: c.ink }}>{t(`focus.profile.groups.${g.id}`)}</span>
                  {g.id === 'presentation' && (
                    <div ref={infoRef} style={{ position: 'relative', display: 'inline-flex' }}>
                      <button onClick={() => setInfo((v) => !v)} aria-label={t('focus.profile.info.title')} title={t('focus.profile.info.title')}
                        style={{ width: 18, height: 18, borderRadius: 'var(--crm-radius-pill)', border: 0, padding: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
                          background: info ? c.ink : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.06)') }}>
                        <PfIc name="info" size={12} stroke={info ? c.onInk : (dark ? 'rgba(235,240,245,0.9)' : c.sub)} sw={2} />
                      </button>
                      {info && (
                        <div className="pfx-info-in" role="tooltip" style={{ position: 'absolute', top: 'calc(100% + 9px)', left: -6, zIndex: 30,
                          width: 264, background: dark ? '#1B1D22' : '#FFFFFF', borderRadius: 'var(--crm-radius-xl)', boxShadow: c.shadow, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', transformOrigin: 'top left', border: c.hair }}>
                          <span style={{ position: 'absolute', top: -6, left: 11, width: 11, height: 11, background: dark ? '#1B1D22' : '#FFFFFF', transform: 'rotate(45deg)', borderRadius: 'var(--crm-radius-2xs)', borderTop: c.hair, borderLeft: c.hair }} />
                          <div style={{ position: 'relative', fontSize: 'var(--crm-text-md)', fontWeight: 800, color: c.ink, letterSpacing: -0.2, marginBottom: 5 }}>{t('focus.profile.info.title')}</div>
                          <div style={{ position: 'relative', fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: c.soft, fontWeight: 500 }}>
                            {(() => {
                              const parts = t('focus.profile.info.body').split('{{brand}}')
                              return (<>{parts[0]}<b style={{ color: c.ink, fontWeight: 700 }}>MEGGA</b>{parts[1] ?? ''}</>)
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
                  {g.rows.map((r) => (
                    <div key={r.key} style={{ gridColumn: r.multiline ? '1 / -1' : 'auto', minWidth: 0 }}>
                      <PfEditField c={c} row={toRow(r)} value={strVal(r.key)} editing={editKey === r.key} saved={savedKey === r.key}
                        draft={draft} setDraft={setDraft} labels={editLabels}
                        onEdit={() => startEdit(r.key)} onSave={saveField} onCancel={() => setEditKey(null)} />
                    </div>
                  ))}
                </div>
                {gi < PF_GROUPS.length - 1 && <div style={{ height: 1, background: c.hairSoft, margin: '12px 12px 0' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {photoModal && (
        <PfPhotoModal c={c} initial={avatarUrl ?? null} labels={photoLabels}
          onCancel={() => setPhotoModal(false)} onSave={onPhotoSave} />
      )}
    </div>
  )
}
