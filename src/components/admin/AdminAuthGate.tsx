/**
 * Porte d'entrée de la console super-admin (admin.megga.ch) : reprise de la
 * session passée par le CRM, gate super-admin et journal d'audit d'ouverture.
 *
 * La console N'EST PAS une porte d'entrée : elle ne porte aucun formulaire de
 * connexion. Elle reçoit la session de qui l'ouvre depuis le CRM (passage par
 * fragment, cf. `openAdminConsole` + `main.admin.tsx`) ; sans session, elle
 * renvoie au CRM et s'arrête là. Il n'existe qu'un endroit où l'on
 * s'authentifie.
 *
 * Le mur réel reste la DB (RLS + is_super_admin) et les edges
 * (require-super-admin) : ce gate ne fait qu'éviter d'afficher une console qui
 * répondrait 403 partout.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { supabase } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'
import { CRM_APP_URL } from '@/lib/adminEntry'

// Une seule ligne d'audit par chargement de page : sur son domaine dédié, un
// chargement = une ouverture de console, ce qui est la granularité voulue.
let entryLogged = false

/**
 * Journalise l'ouverture. Best-effort : un échec n'enferme pas l'admin dehors
 * (une relance, puis on abandonne).
 *
 * L'échec part chez Sentry, PAS dans la console : une écriture d'arrière-plan
 * non bloquante ne doit pas se présenter comme une erreur de page. Elle
 * ferait échouer la garde « zéro erreur console » de la suite e2e-admin, qui a
 * raison de traiter une erreur console comme bloquante.
 */
async function logConsoleEntry() {
  if (entryLogged) return
  entryLogged = true
  const write = (retry: boolean) =>
    supabase.rpc('admin_log_console_entry', {
      p_metadata: retry
        ? { origin: window.location.origin, retry: true }
        : { origin: window.location.origin },
    })

  const first = await write(false)
  if (!first.error) return
  const second = await write(true)
  if (!second.error) return

  Sentry.captureMessage(`[admin] audit d'ouverture de console refusé : ${second.error.message}`, 'warning')
  if (import.meta.env.DEV) console.warn('[AdminAuthGate] audit entry failed:', second.error.message)
}

/** Écran neutre pendant la résolution de session (évite un flash de formulaire). */
function Waiting() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-page">
      <div className="h-6 w-6 rounded-full border-2 border-theme-border border-t-admin-accent animate-spin" />
    </div>
  )
}

/** Coquille centrée commune aux écrans de cul-de-sac (renvoi CRM, refus). */
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

/**
 * Aucune session : la console NE PROPOSE PAS de se connecter.
 *
 * Il n'existe qu'un endroit où l'on s'authentifie — le CRM — et la console
 * reçoit la session de celui qui l'ouvre depuis là (cf. `openAdminConsole`).
 * Cet écran est donc un cul-de-sac volontaire : ni champ, ni formulaire, ni
 * lien magique. Rien à hameçonner ici, et rien à essayer en force.
 */
function FromCrmOnlyScreen() {
  return (
    <Panel title="Accès depuis le CRM">
      <p className="text-sm text-theme-secondary">
        La console n'a pas de connexion propre. Ouvrez-la depuis le CRM, par le menu de
        votre profil.
      </p>
      <a
        href={CRM_APP_URL}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-admin-accent/30 px-3 text-sm font-medium text-admin-accent transition-colors hover:bg-admin-accent/5"
      >
        Aller au CRM
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
      void logConsoleEntry()
    }
  }, [allowed])

  if (loading) return <Waiting />
  if (!user) return <FromCrmOnlyScreen />
  if (checking) return <Waiting />
  if (!allowed) return <DeniedScreen />

  return <>{children}</>
}
