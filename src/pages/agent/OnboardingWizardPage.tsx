import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Upload, UserPlus, Sparkles, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useCreateContact } from '@/hooks/useContacts'
import { seedDemoData } from '@/lib/seedDemoData'
import { supabase } from '@/lib/supabase'
import { CANTONS } from '@/lib/constants'

// ── Step indicator (monochrome) ───────────────────────────────────────────

const STEPS = ['Profil', 'Contacts', "C'est prêt !"]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-8 mb-10">
      {STEPS.map((label, i) => (
        <button
          key={label}
          className={cn(
            'text-sm pb-2 border-b-2 transition-colors cursor-default',
            i === current
              ? 'text-theme-primary border-theme-primary font-semibold'
              : i < current
                ? 'text-theme-secondary border-theme-primary'
                : 'text-theme-muted border-transparent'
          )}
        >
          {i + 1}. {label}
        </button>
      ))}
    </div>
  )
}

// ── Step 1: Profile ───────────────────────────────────────────────────────

function StepProfile({ onNext }: { onNext: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState(profile?.full_name?.split(' ')[0] ?? '')
  const [lastName, setLastName] = useState(profile?.full_name?.split(' ').slice(1).join(' ') ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [canton, setCanton] = useState(profile?.canton ?? '')
  const [language, setLanguage] = useState('fr')
  const [saving, setSaving] = useState(false)

  const isValid = firstName.trim() && lastName.trim() && canton

  const handleSave = async () => {
    if (!isValid || !profile) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim() || null,
        canton,
        onboarding_step: 1,
      }).eq('id', profile.id)
      await refreshProfile()
      onNext()
    } finally {
      setSaving(false)
    }
  }

  const inputClasses = 'w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors text-theme-primary'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">Votre profil</h2>
        <p className="text-sm text-theme-secondary mt-1">Quelques informations pour personnaliser votre expérience.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-theme-primary mb-1.5">Prénom *</label>
          <input value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClasses} placeholder="Prénom" />
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-primary mb-1.5">Nom *</label>
          <input value={lastName} onChange={e => setLastName(e.target.value)} className={inputClasses} placeholder="Nom" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-theme-primary mb-1.5">Téléphone</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClasses} placeholder="+41 22 000 00 00" />
      </div>

      <div>
        <label className="block text-sm font-medium text-theme-primary mb-1.5">Canton *</label>
        <div className="flex flex-wrap gap-1.5">
          {CANTONS.map(c => (
            <button
              key={c}
              onClick={() => setCanton(c)}
              className={cn(
                'h-8 px-3 rounded-lg text-sm transition-colors',
                canton === c ? 'bg-theme-active text-theme-primary font-medium' : 'text-theme-secondary hover:text-theme-primary border border-theme-border'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-theme-primary mb-1.5">Langue</label>
        <div className="flex gap-2">
          {['FR', 'DE', 'EN', 'IT'].map(l => (
            <button
              key={l}
              onClick={() => setLanguage(l.toLowerCase())}
              className={cn(
                'h-9 px-4 rounded-lg text-sm transition-colors',
                language === l.toLowerCase() ? 'bg-theme-active text-theme-primary font-medium' : 'text-theme-secondary hover:text-theme-primary border border-theme-border'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="h-10 px-6 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40"
        >
          {saving ? 'Enregistrement...' : 'Continuer'}
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Contacts ──────────────────────────────────────────────────────

interface MiniContact {
  firstName: string
  lastName: string
  email: string
  phone: string
  type: 'buyer' | 'seller'
}

function StepContacts({ onNext }: { onNext: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const createContact = useCreateContact()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'choose' | 'manual' | 'seeding' | 'done'>('choose')
  const [contacts, setContacts] = useState<MiniContact[]>([
    { firstName: '', lastName: '', email: '', phone: '', type: 'buyer' },
  ])
  const [importedCount, setImportedCount] = useState(0)
  const [seeding, setSeeding] = useState(false)

  const handleSeedDemo = async () => {
    if (!profile?.agency_id || !profile?.id) return
    setSeeding(true)
    const result = await seedDemoData(profile.agency_id, profile.id)
    setSeeding(false)
    if (result.success) {
      setImportedCount(10)
      setMode('done')
    }
  }

  const handleManualSave = async () => {
    if (!profile) return
    const validContacts = contacts.filter(c => c.firstName.trim() && c.lastName.trim())
    for (const c of validContacts) {
      await createContact.mutateAsync({
        firstName: c.firstName.trim(),
        lastName: c.lastName.trim(),
        email: c.email.trim(),
        phone: c.phone.trim() || undefined,
        type: c.type,
      })
    }
    setImportedCount(validContacts.length)
    setMode('done')
  }

  const handleGoImport = async () => {
    if (profile) {
      await supabase.from('profiles').update({ onboarding_step: 2 }).eq('id', profile.id)
    }
    navigate('/dashboard/contacts/import')
  }

  const handleContinue = async () => {
    if (profile) {
      await supabase.from('profiles').update({ onboarding_step: 2 }).eq('id', profile.id)
      await refreshProfile()
    }
    onNext()
  }

  const addRow = () => {
    if (contacts.length < 10) {
      setContacts([...contacts, { firstName: '', lastName: '', email: '', phone: '', type: 'buyer' }])
    }
  }

  const removeRow = (i: number) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, idx) => idx !== i))
    }
  }

  const updateRow = (i: number, field: keyof MiniContact, value: string) => {
    const updated = [...contacts]
    updated[i] = { ...updated[i], [field]: value }
    setContacts(updated)
  }

  const inputClasses = 'w-full h-9 px-2.5 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors text-theme-primary'

  if (mode === 'done') {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-lg font-semibold text-theme-primary">{importedCount} contacts importés</p>
          <p className="text-sm text-theme-secondary mt-1">Votre CRM est prêt.</p>
        </div>
        <div className="flex justify-end">
          <button onClick={handleContinue} className="h-10 px-6 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors">
            Continuer
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'manual') {
    const hasValid = contacts.some(c => c.firstName.trim() && c.lastName.trim())
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-theme-primary">Ajouter des contacts</h2>
          <p className="text-sm text-theme-secondary mt-1">Créez quelques contacts pour démarrer.</p>
        </div>

        <div className="space-y-3">
          {contacts.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={c.firstName} onChange={e => updateRow(i, 'firstName', e.target.value)} placeholder="Prénom" className={cn(inputClasses, 'flex-1')} />
              <input value={c.lastName} onChange={e => updateRow(i, 'lastName', e.target.value)} placeholder="Nom" className={cn(inputClasses, 'flex-1')} />
              <input value={c.email} onChange={e => updateRow(i, 'email', e.target.value)} placeholder="Email" className={cn(inputClasses, 'flex-1')} />
              <select value={c.type} onChange={e => updateRow(i, 'type', e.target.value)} className={cn(inputClasses, 'w-28')}>
                <option value="buyer">Acheteur</option>
                <option value="seller">Vendeur</option>
              </select>
              {contacts.length > 1 && (
                <button onClick={() => removeRow(i)} className="text-theme-muted hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-theme-secondary hover:text-theme-primary transition-colors">
          <Plus className="h-3.5 w-3.5" /> Ajouter un contact
        </button>

        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setMode('choose')} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            ← Retour
          </button>
          <button
            onClick={handleManualSave}
            disabled={!hasValid || createContact.isPending}
            className="h-10 px-6 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40"
          >
            {createContact.isPending ? 'Enregistrement...' : 'Enregistrer et continuer'}
          </button>
        </div>
      </div>
    )
  }

  // Mode: choose
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">Vos contacts</h2>
        <p className="text-sm text-theme-secondary mt-1">Importez vos clients existants ou explorez avec des données de démo.</p>
      </div>

      <div className="grid gap-3">
        <button
          onClick={handleGoImport}
          className="flex items-start gap-4 p-4 rounded-xl border border-theme-border hover:border-theme-active transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-lg bg-theme-active flex items-center justify-center shrink-0">
            <Upload className="h-5 w-5 text-theme-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">Importer un fichier CSV / vCard</p>
            <p className="text-xs text-theme-tertiary mt-0.5">Importez vos contacts depuis un fichier existant.</p>
          </div>
        </button>

        <button
          onClick={() => setMode('manual')}
          className="flex items-start gap-4 p-4 rounded-xl border border-theme-border hover:border-theme-active transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-lg bg-theme-active flex items-center justify-center shrink-0">
            <UserPlus className="h-5 w-5 text-theme-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">Ajouter manuellement</p>
            <p className="text-xs text-theme-tertiary mt-0.5">Créez 1 à 10 contacts rapidement.</p>
          </div>
        </button>

        <button
          onClick={handleSeedDemo}
          disabled={seeding}
          className="flex items-start gap-4 p-4 rounded-xl border border-theme-border hover:border-theme-active transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-lg bg-theme-active flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-theme-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">{seeding ? 'Création en cours...' : 'Explorer avec des données de démo'}</p>
            <p className="text-xs text-theme-tertiary mt-0.5">10 contacts, 5 biens, 3 transactions — données réalistes suisses.</p>
          </div>
        </button>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={handleContinue} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
          Passer cette étape →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Done ──────────────────────────────────────────────────────────

function StepDone() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [finishing, setFinishing] = useState(false)

  const handleFinish = async () => {
    if (!profile) return
    setFinishing(true)
    await supabase.from('profiles').update({
      onboarding_completed: true,
      onboarding_step: 3,
    }).eq('id', profile.id)
    await refreshProfile()
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="text-center py-8 space-y-6">
      {/* Animated check */}
      <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
          <Check className="h-6 w-6 text-emerald-500" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-theme-primary">Votre espace est prêt</h2>
        <p className="text-sm text-theme-secondary mt-2 max-w-sm mx-auto">
          Votre Action Board vous guide au quotidien — relances, matchs, visites, tout est centralisé.
        </p>
      </div>

      <div className="flex items-center justify-center gap-6 text-xs text-theme-muted">
        <span>Données en Europe</span>
        <span>·</span>
        <span>Conforme nFADP</span>
      </div>

      <button
        onClick={handleFinish}
        disabled={finishing}
        className="h-11 px-8 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40"
      >
        {finishing ? 'Chargement...' : 'Accéder à mon dashboard'}
      </button>
    </div>
  )
}

// ── Main Wizard ───────────────────────────────────────────────────────────

export default function OnboardingWizardPage() {
  const { profile } = useAuth()
  const [step, setStep] = useState(profile?.onboarding_step ?? 0)

  return (
    <div className="min-h-screen bg-theme-page flex flex-col items-center px-4 py-12">
      {/* Logo */}
      <img src="/megga-logo.svg" alt="MEGGA" className="h-8 mb-10" style={{ filter: 'var(--logo-filter, none)' }} />

      <div className="w-full max-w-2xl">
        <StepIndicator current={step} />

        {step === 0 && <StepProfile onNext={() => setStep(1)} />}
        {step === 1 && <StepContacts onNext={() => setStep(2)} />}
        {step === 2 && <StepDone />}
      </div>
    </div>
  )
}
