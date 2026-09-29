// MEGGA CRM — Écran « Aujourd'hui » (refonte Claude Design, port fidèle).
//
// Page unique = « concept H » (handoff Today V2, 3 août 2026) — un seul bento :
// la journée, le segment Dossiers | Annonces | Matching et « Pendant ton
// absence », lus en base par `PageAujourdhuiH` (`useTodayH`, `useHotDeals`,
// `useListingActions`, `useMatchingDuJour`, `useAbsenceSignals`).
// Les matchs du jour s'y lisent dans le segment Matching, et se traitent dans le
// fil de matchs (`/dashboard/matching`). Chrome CRM standard (`CrmWorkspace`).
//
// Porté de `crm-screen-today-proto.jsx` : applyTK(dark) « allume » l'ambiance du
// cockpit.

import { useNavigate } from 'react-router-dom'
import { crmPalette } from '@/components/crm/tokens'
import type { CrmScreenId } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { TK, applyTK } from '@/components/crm/today/tk'
import { TodayNavProvider } from '@/components/crm/today/TodayNavContext'
import { PageAujourdhuiH } from '@/components/crm/today/PageAujourdhuiH'
import { useCrmDarkPref } from '@/lib/crmDark'
import { PARAM_QUI_POUR } from '@/components/matching-fil/filLiens'
import { avecArrivee } from '@/lib/jetonArrivee'

export default function TodayPage() {
  const navigate = useNavigate()

  // ─── Theme: dark/light, tied to the icon-rail toggle ─────────────────
  const [dark, setDark] = useCrmDarkPref()

  const sp = crmPalette(dark)
  // « allume » / éteint tout le cockpit selon l'ambiance (singleton muté en place).
  applyTK(dark)

  // `ref` = identifiant réel porté par le payload (uuid). Les cibles « détail »
  // n'existent qu'avec lui : sans référence, on ouvre la LISTE correspondante
  // plutôt que de laisser un bouton sans effet.
  const onNavigate = (id: CrmScreenId | string, ref?: string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'contact-detail': navigate(ref ? `/dashboard/contacts/${ref}` : '/dashboard/contacts'); break
      case 'deal-detail': navigate(ref ? `/dashboard/transactions/${ref}` : '/dashboard/pipeline'); break
      case 'visite-detail': navigate(ref ? `/dashboard/visits/${ref}` : '/dashboard/calendar'); break
      case 'biens-detail': navigate(ref ? `/dashboard/listings/${ref}` : '/dashboard/listings'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      // Lot D1 : une place précise du fil (la requête de `lienFil`), et la fiche d'un mandat défilée jusqu'à « Qui pour
      // ce bien ? ». ⛔ Gabarits ANCRÉS (`/dashboard/…`) : `redirection-ouverte.spec.ts` refuse un puits dynamique.
      // Lot E1 : chaque arrivée porte un jeton neuf (`avecArrivee`) — l'écran l'applique une fois, un nouveau clic la
      // rejoue.
      case 'matching-fil': navigate(`/dashboard/matching${ref ? `?${ref}` : ''}`, ref ? avecArrivee() : undefined); break
      case 'biens-qui-pour': navigate(ref ? `/dashboard/listings/${ref}?${PARAM_QUI_POUR}=1` : '/dashboard/listings', ref ? avecArrivee() : undefined); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'messagerie': navigate('/dashboard/messagerie'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
        /* Pas de toast « à venir » — un bouton qui ne fait rien doit disparaître. */
    }
  }

  return (
    <TodayNavProvider value={{ navigate: onNavigate }}>
      <div className="today-proto-amb" style={{
        position: 'relative',
        background: TK.bg,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
        color: sp.ink,
      }}>
        <style>{`
          .today-proto-amb { transition: background-color .55s ease, color .45s ease; }
          .today-proto-amb *:not(button) {
            transition: background-color .55s ease, border-color .55s ease, color .45s ease, box-shadow .55s ease, fill .45s ease, stroke .45s ease;
          }
          @keyframes focus-ping { 0% { transform: scale(1); opacity: .7; } 75%, 100% { transform: scale(2.4); opacity: 0; } }
          @keyframes fmRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes m2pulse { 0% { transform: scale(1); opacity: .7; } 75%, 100% { transform: scale(2.2); opacity: 0; } }
        `}</style>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <CrmWorkspace active="today" sp={sp} dark={dark} setDark={setDark}>
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 24, paddingBottom: 'var(--crm-space-6xl)' }}>
            {/* Le cadre bento — il clippe la page à ses coins arrondis */}
            <div style={{
              position: 'relative', height: '100%', overflow: 'hidden',
              /**
               * ⛔ CE CADRE N'AVAIT AUCUN FOND, et en CLAIR ça se voyait :
               * « pourquoi MEGGA AI est plus blanc que les autres ? » (Julien,
               * 20.09.2026). Il ne l'était pas — c'est CE cadre qui était plus
               * gris. Mesuré au rendu, les trois panneaux côte à côte : barre
               * latérale `#ffffff`, dock `#ffffff`, et celui-ci TRANSPARENT,
               * donc laissant voir le canvas `#f9f9f9`. ΔL* 2,07 d'écart, sur
               * 752 px de large — assez pour se lire comme un autre blanc.
               *
               * ⚠ En SOMBRE le défaut était invisible : `TK.frame` y vaut le
               * gris unique, donc transparent ou peint revenait au même. C'est
               * le clair, qui sépare par un palier, qui le révèle. Même famille
               * que les ombres noires sur l'ancien canvas.
               */
              background: TK.frame,
              // ⚠ `26` était un littéral hors échelle, et désaccordé de la carte
              // latérale comme du dock, qui rendent tous deux 20 px.
              borderRadius: 'var(--crm-radius-4xl)',
              border: `1px solid ${TK.border}`,
              boxShadow: TK.shadowLg,
            }}>
              <PageAujourdhuiH />
            </div>
          </main>
          </CrmWorkspace>
        </div>
      </div>
    </TodayNavProvider>
  )
}
