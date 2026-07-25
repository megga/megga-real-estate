/**
 * Porte d'entrée de la console super-admin (admin.megga.ch) : connexion, gate
 * super-admin et journal d'audit d'ouverture.
 *
 * La console ne partage RIEN avec le CRM (origine distincte = ni localStorage,
 * ni cookies, ni session Supabase) : elle porte donc son propre écran de
 * connexion, par mot de passe, sans passer par la vitrine. Le mur réel reste la
 * DB (RLS + is_super_admin) et les edges (require-super-admin) : cet écran ne
 * fait qu'éviter d'afficher une console qui répondrait 403 partout.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { supabase } from '@/lib/supabase'
import { CRM_APP_URL } from '@/lib/adminEntry'

// Une seule ligne d'audit par chargement de page : sur son domaine dédié, un
// chargement = une ouverture de console, ce qui est la granularité voulue.
let entryLogged = false

/** Journalise l'ouverture. Best-effort : un échec n'enferme pas l'admin dehors (une seule relance). */
function logConsoleEntry() {
  if (entryLogged) return
  entryLogged = true
  void supabase.rpc('admin_log_console_entry', { p_metadata: { origin: window.location.origin } })
    .then(({ error }) => {
      if (!error) return
      console.error('[AdminAuthGate] audit entry failed, retrying once:', error.message)
      void supabase.rpc('admin_log_console_entry', {
        p_metadata: { origin: window.location.origin, retry: true },
      })
    })
}

/** Écran neutre pendant la résolution de session (évite un flash de formulaire). */
function Waiting() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-page">
      <div className="h-6 w-6 rounded-full border-2 border-theme-border border-t-admin-accent animate-spin" />
    </div>
  )
}

/** Coquille centrée commune à la connexion et au refus. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-page px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
        </div>
        <h1 className="text-xl font-semibold text-theme-primary mb-5">{title}</h1>
        {children}
      </div>
    </div>
  )
}

/** Connexion par mot de passe (pas de lien magique : aucune URL de retour à déclarer). */
function LoginScreen() {
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signInWithPassword(email.trim(), password)
    setBusy(false)
    // Message volontairement générique : la console ne dit pas si un compte existe.
    if (error) setError('Identifiants refusés.')
  }

  const field = 'w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-admin-accent transition-colors'

  return (
    <Panel title="Connexion">
      <form onSubmit={submit} className="space-y-3">
        <input type="email" required autoComplete="username" placeholder="E-mail"
          value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        <input type="password" required autoComplete="current-password" placeholder="Mot de passe"
          value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy}
          className="w-full h-10 rounded-lg border border-admin-accent/30 text-admin-accent text-sm font-medium hover:bg-admin-accent/5 transition-colors disabled:opacity-50">
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <a href={CRM_APP_URL} className="block mt-5 text-xs text-theme-tertiary hover:text-theme-secondary transition-colors">
        ← Retour au CRM
      </a>
    </Panel>
  )
}

/** Session valide mais sans droits : on le dit, et on propose la sortie. */
function DeniedScreen() {
  const { signOut, profile } = useAuth()
  return (
    <Panel title="Accès refusé">
      <p className="text-sm text-theme-secondary">
        Le compte {profile?.email ?? 'connecté'} n'a pas accès à la console.
      </p>
      <div className="flex items-center gap-3 mt-5">
        <button onClick={() => void signOut()}
          className="h-9 px-3 rounded-lg border border-theme-border text-sm text-theme-secondary hover:text-theme-primary transition-colors">
          Se déconnecter
        </button>
        <a href={CRM_APP_URL} className="text-xs text-theme-tertiary hover:text-theme-secondary transition-colors">
          Retour au CRM
        </a>
      </div>
    </Panel>
  )
}

/** Enchaîne session → droits → audit, puis rend la console. */
export default function AdminAuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { checking, allowed } = useSuperAdminGate()
  const loggedRef = useRef(false)

  useEffect(() => {
    if (allowed && !loggedRef.current) {
      loggedRef.current = true
      logConsoleEntry()
    }
  }, [allowed])

  if (loading) return <Waiting />
  if (!user) return <LoginScreen />
  if (checking) return <Waiting />
  if (!allowed) return <DeniedScreen />

  return <>{children}</>
}
