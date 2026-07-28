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
 *
 * Ses écrans sont les seuls de la console rendus HORS du cadre du shell : ils
 * portent donc eux-mêmes le repère plateforme (pastille violette + « Admin
 * MEGGA ») que les pages ont abandonné au rail, faute de rail à ce stade.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { logConsoleEntry } from '@/lib/adminConsoleAudit'
import { CRM_APP_URL } from '@/lib/adminEntry'
import { AdminCard, AdminGhostBtn } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

/** Écran neutre pendant la résolution de session (évite un flash de formulaire). */
function Waiting() {
  const { sp, tones } = useAdminSugar()
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: sp.pageBg }}>
      <div
        className="animate-spin"
        style={{
          width: 24, height: 24, borderRadius: ADMIN_RADII.pill,
          border: `2px solid ${sp.frameBorder}`, borderTopColor: tones.accent,
        }}
      />
    </div>
  )
}

/** Coquille centrée commune aux écrans de cul-de-sac (renvoi CRM, refus). */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  const { sp, tones } = useAdminSugar()
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: sp.pageBg }}>
      <AdminCard padding={26} radius={ADMIN_RADII.frame} className="w-full max-w-sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}>
          <span style={{ width: 7, height: 7, borderRadius: ADMIN_RADII.pill, background: tones.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: -0.1, color: tones.accent }}>Admin MEGGA</span>
        </div>
        <h1 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: sp.ink, lineHeight: 1.15 }}>
          {title}
        </h1>
        {children}
      </AdminCard>
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
  const { sp, surf } = useAdminSugar()
  return (
    <Panel title="Accès depuis le CRM">
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: sp.sub, lineHeight: 1.5 }}>
        La console n'a pas de connexion propre. Ouvrez-la depuis le CRM, par le menu de
        votre profil.
      </p>
      {/* Lien plein (autre origine) : grammaire du bouton ghost, sans en être un. */}
      <a
        href={CRM_APP_URL}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 18,
          height: 34, padding: '0 15px', borderRadius: ADMIN_RADII.pill,
          fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
          color: sp.ink, background: surf.card, boxShadow: sp.shadowSm,
        }}
      >
        Aller au CRM
      </a>
    </Panel>
  )
}

/** Session valide mais sans droits : on le dit, et on propose la sortie. */
function DeniedScreen() {
  const { signOut, profile } = useAuth()
  const { sp } = useAdminSugar()
  return (
    <Panel title="Accès refusé">
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: sp.sub, lineHeight: 1.5 }}>
        Le compte {profile?.email ?? 'connecté'} n'a pas accès à la console.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <AdminGhostBtn onClick={() => void signOut()}>Se déconnecter</AdminGhostBtn>
        <a href={CRM_APP_URL} style={{ fontSize: 12, fontWeight: 600, color: sp.sub, textDecoration: 'none' }}>
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
