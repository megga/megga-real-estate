// Allowlist UX des emails super-admin — doublon CÔTÉ AFFICHAGE de la source de
// vérité SQL (super_admin_allowlist(), migration 20260705160000_super_admin_
// allowlist_lockdown.sql). L'enforcement réel est en DB (is_super_admin) et sur
// les edges (_shared/require-super-admin.ts) ; ce fichier sert uniquement à ne
// pas afficher une section admin qui répondrait 403 partout.
//
// Les emails '@….local' (CI/dev, TLD non routable) sont tolérés pour refléter
// l'échappatoire CI SQL — sans effet en prod (aucun compte réel en .local, et
// le backend reste le mur).

export const SUPER_ADMIN_EMAILS = ['hello@juarts.com', 'ttaillefer.dev@gmail.com'] as const

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.trim().toLowerCase()
  return (SUPER_ADMIN_EMAILS as readonly string[]).includes(lower) || /@[a-z0-9.-]+\.local$/.test(lower)
}
