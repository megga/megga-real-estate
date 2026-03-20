import { useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export default function MonProfilPage() {
  const navigate = useNavigate()
  const { profile, signOut, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id)

    setSaving(false)
    if (!error) {
      setSaved(true)
      await refreshProfile()
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Mon profil
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez vos informations personnelles
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-card border border-border shadow-card p-6 space-y-5">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-primary-700 mb-1.5">
            Nom complet
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-11 px-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-primary-700 mb-1.5">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            value={profile?.email || ''}
            disabled
            className="w-full h-11 px-4 text-sm bg-gray-100 border border-border rounded-input text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground mt-1">L'adresse e-mail ne peut pas être modifiée</p>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-primary-700 mb-1.5">
            Téléphone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+41 79 123 45 67"
            className="w-full h-11 px-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
          </Button>
          {saved && (
            <p className="text-sm text-success font-medium">Modifications enregistrées</p>
          )}
        </div>
      </form>

      {/* Sign out */}
      <div className="bg-white rounded-card border border-border shadow-card p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-2">Déconnexion</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Vous serez déconnecté de votre compte MEGGA.
        </p>
        <Button variant="outline" onClick={handleSignOut} className="text-danger border-danger/30 hover:bg-danger/5">
          <LogOut className="h-4 w-4 mr-2" />
          Se déconnecter
        </Button>
      </div>
    </div>
  )
}
