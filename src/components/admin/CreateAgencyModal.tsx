// P8b — Création d'agence (super-admin). Le propriétaire est invité SÉPARÉMENT
// (bouton distinct, non couplé) — la création ne rattache personne.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/ui/modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { CANTONS } from '@/lib/constants'
import { useAdminCreateAgency } from '@/hooks/useAdminCreateAgency'

const PLAN_IDS = ['starter', 'pro', 'entreprise'] as const

export default function CreateAgencyModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const navigate = useNavigate()
  const createAgency = useAdminCreateAgency()

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [canton, setCanton] = useState('')
  const [plan, setPlan] = useState<typeof PLAN_IDS[number]>('starter')
  const [solo, setSolo] = useState(false)
  const [note, setNote] = useState('')

  const handleCreate = () => {
    if (name.trim().length < 2) { toast.error(t('createAgency.nameRequired')); return }
    createAgency.mutate(
      { name: name.trim(), city, canton, plan, solo, note },
      {
        onSuccess: (id) => {
          toast.success(t('createAgency.created'))
          onClose()
          navigate(`/agencies/${id}`)
        },
        onError: (e) => toast.error((e as Error).message.includes('already exists')
          ? t('createAgency.duplicate')
          : t('createAgency.error')),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title={t('createAgency.title')} size="md">
      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('createAgency.name')}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
            className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('createAgency.city')}</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:border-admin-accent" />
          </div>
          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('createAgency.canton')}</label>
            <select value={canton} onChange={e => setCanton(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:border-admin-accent">
              <option value="">—</option>
              {CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('createAgency.plan')}</label>
          <div className="flex items-center gap-1.5">
            {PLAN_IDS.map(p => (
              <button key={p} onClick={() => setPlan(p)}
                className={cn('h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                  plan === p ? 'bg-admin-accent/10 text-admin-accent' : 'bg-theme-hover text-theme-muted hover:text-theme-primary')}>
                {t(`common.plan.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
          <input type="checkbox" checked={solo} onChange={e => setSolo(e.target.checked)} className="accent-admin-accent" />
          {t('createAgency.solo')}
        </label>

        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('createAgency.note')}</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={t('createAgency.notePlaceholder')}
            className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:border-admin-accent" />
        </div>

        <p className="text-xs text-theme-muted">{t('createAgency.inviteHint')}</p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="h-9 px-4 text-sm text-theme-secondary hover:text-theme-primary transition-colors">{t('common.cancel')}</button>
          <button onClick={handleCreate} disabled={createAgency.isPending}
            className="h-9 px-4 text-sm font-medium border border-admin-accent text-admin-accent rounded-lg hover:bg-admin-accent/10 transition-colors disabled:opacity-50">
            {createAgency.isPending ? t('common.saving') : t('createAgency.submit')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
