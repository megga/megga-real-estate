/**
 * Harnais d'aperçu de la FACE PUBLIQUE — `/dev/public`, sans session ni jeton.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ──────────────────────────────────────────────
 * ⛔ AUCUN BANC NE COUVRAIT CE QUE LE CLIENT VOIT. `/dev/crm` monte onze surfaces
 * `/dashboard` ; les quatre surfaces publiques prennent un JETON dans l'URL et
 * lisent tout par une edge function. Sans jeton valide, `KycPublicPage` finit sur
 * `return null` — une page BLANCHE. Le chantier « face publique » (15 août 2026)
 * a donc été vérifié en posant un intercepteur à la main depuis le navigateur,
 * ce qui ne se garde pas et ne se transmet pas.
 *
 * ⚠ IL A FALLU DEUX CHOSES POUR QUE CE BANC SOIT POSSIBLE, et aucune n'était de
 * la mise en scène :
 *   1. `bancSupabase` répondait `{ok:true, banc:true}` à TOUTE edge function. Sans
 *      fixture par fonction, ces écrans ne montrent pas un état vide : ils
 *      montrent une erreur. D'où `contrat.edges`.
 *   2. `useMagicLinkClient` et `useAppointmentBooking` construisaient leur URL en
 *      lisant l'environnement NU, sans le repli de `lib/supabase`. L'URL devenait
 *      RELATIVE, l'intercepteur — qui reconnaît les appels absolus — ne la voyait
 *      pas, et en production sans secret la page rendait blanc au lieu de son
 *      écran « lien invalide ».
 *
 * ── CE QUE CE BANC NE FAIT PAS ───────────────────────────────────────────────
 * Il ne recopie AUCUNE mécanique : les quatre pages sont montées telles quelles,
 * par des routes IMBRIQUÉES qui leur donnent le `:token` qu'elles lisent. Un banc
 * qui reconstruirait le parcours mesurerait sa copie.
 *
 * ⚠ Routes imbriquées, pas un second `<Router>` : React Router en refuse un dans
 * un autre — c'est la raison pour laquelle `/dev/admin` est branché à part, plus
 * haut dans `App()`.
 *
 * ⛔ Données de DÉMONSTRATION, et rien n'écrit : l'intercepteur répond aussi aux
 * POST (dépôt de pièce, réservation, réaction acheteur).
 */
import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import KycPublicPage from '@/pages/public/KycPublicPage'
import AppointmentManagePage from '@/pages/public/AppointmentManagePage'
import BuyerReceptionPage from '@/pages/public/BuyerReceptionPage'
import VisitManagePage from '@/pages/public/VisitManagePage'
import VisitFeedbackPage from '@/pages/public/VisitFeedbackPage'
import AcceptInvitePage from '@/pages/public/AcceptInvitePage'
import { installerBanc, reglerBanc } from './bancSupabase'
import { apptCreneaux, apptVue, invitationVue, mlkVue, receptionVue, visiteVue, type PublicEtat } from './publicFixtures'

const ETATS: { id: PublicEtat; label: string; titre: string }[] = [
  { id: 'nominal', label: 'Nominal', titre: 'Le parcours tel que le client l’ouvre' },
  { id: 'termine', label: 'Terminé', titre: 'Pièces déposées · rendez-vous pris · sélection traitée' },
  { id: 'expire', label: 'Expiré', titre: 'Lien périmé, rendez-vous annulé, sélection close' },
]

/**
 * ⚠ `chemin` PORTE SON JETON SOUS LA FORME QUE LA PAGE LIT, et les deux formes
 * coexistent : les trois premières prennent le leur dans le CHEMIN
 * (`useParams`), les deux visites dans la QUERY (`searchParams.get('token')`).
 * Monter une visite en `visite/banc` la laisserait sans jeton — elle rendrait
 * son écran « lien invalide », et on croirait regarder un défaut de fixture.
 */
const SURFACES = [
  { chemin: 'kyc/banc', label: 'KYC · parcours client', route: '/kyc/:token' },
  { chemin: 'rendez-vous/banc', label: 'Rendez-vous', route: '/rendez-vous/:token' },
  { chemin: 'reception/banc', label: 'Réception acheteur', route: '/reception/:token' },
  // Lot 6 (15 août 2026) — les trois pages CLIENTES qu'aucun banc ne montrait,
  // et que la passe B2/B3 doit repeindre. Les regarder est le préalable.
  { chemin: 'visite?token=banc', label: 'Visite · modifier', route: '/visit/:id/edit' },
  { chemin: 'avis?token=banc', label: 'Visite · avis', route: '/visit/:id/feedback' },
  { chemin: 'invitation/banc', label: 'Invitation équipe', route: '/accept-invite/:token' },
]

export default function PublicShowcasePage() {
  const [etat, setEtat] = useState<PublicEtat>('nominal')
  const { pathname } = useLocation()

  /**
   * ⛔ LE CONTRAT SE POSE AVANT LE PREMIER RENDU DES ENFANTS, PAS DANS UN EFFET.
   *
   * Mesuré : avec `reglerBanc` en `useEffect` seul, les pages montaient, lançaient
   * leur requête, et recevaient le `{ok:true, banc:true}` par défaut — l'écran
   * s'affichait avec TOUS ses replis (« votre agent », « Invalid Date »). Ça ne
   * ressemble pas à un banc cassé : ça ressemble à une fixture incomplète, et on
   * va corriger la fixture. L'initialiseur de `useState` est synchrone et court
   * AVANT les enfants ; l'effet ne sert plus qu'aux bascules d'état.
   *
   * ⚠ Idempotent : `installerBanc` se protège d'une seconde enveloppe, qui
   * ferait de l'origine sauvegardée… l'intercepteur lui-même (StrictMode).
   */
  useState(() => { installerBanc(); poserContrat('nominal'); return null })

  useEffect(() => {
    poserContrat(etat)
  }, [etat])

  return rendu(etat, setEtat, pathname)
}

function poserContrat(etat: PublicEtat) {
  reglerBanc({
      etat: 'nominal',
      tables: {},
      // ⛔ Les deux visites lisent une RPC, pas une edge : la lecture directe de
      //   `visits` a été retirée en juillet 2026 avec sa policy anon trop large.
      rpc: { get_visit_by_token: visiteVue(etat) },
      edges: {
        'magic-link-get': mlkVue(etat),
        'magic-link-upload': { upload_id: 'demo', filename: 'demo.pdf', size_bytes: 1024, type: 'identity', sha256_hash: null, uploaded_at: new Date().toISOString(), status: 'received' },
        'magic-link-confirm': { ok: true },
        'appointment-manage': apptVue(etat),
        'appointment-slots': apptCreneaux(),
        'appointment-book': { ok: true },
        'buyer-reception-get': receptionVue(etat),
        'buyer-reception-react': { ok: true },
        'accept-team-invite': invitationVue(etat),
        // Les gestes des deux visites : rien n'écrit, mais sans fixture le banc
        // SIGNALE la fonction et l'écran montre une erreur au lieu d'un succès.
        'visit-reschedule': { ok: true },
        'visit-cancel': { ok: true },
      },
  })
}

function rendu(etat: PublicEtat, setEtat: (e: PublicEtat) => void, pathname: string) {
  return (
    <div style={{ minHeight: '100vh', background: '#0b0b0c' }}>
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 50, display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', gap: 'var(--crm-space-3, 12px)',
          padding: '10px 16px', background: '#0b0b0c', color: '#ededed',
          fontSize: 'var(--crm-text-md)', fontWeight: 500,
        }}
      >
        <span style={{ opacity: 0.55 }}>Face publique</span>
        {SURFACES.map((s) => {
          // ⚠ Sur le SEGMENT, pas sur la chaîne entière : deux des chemins
          //   portent leur jeton en query (`visite?token=banc`).
          const actif = pathname.includes(s.chemin.split(/[/?]/)[0]!)
          return (
            <Link
              key={s.chemin}
              to={s.chemin}
              style={{
                padding: '6px 12px', borderRadius: 999, textDecoration: 'none',
                background: actif ? '#424bfb' : '#1c1c1e', color: '#ffffff',
              }}
            >
              {s.label}
            </Link>
          )
        })}
        <span style={{ marginLeft: 'auto', opacity: 0.55 }}>État</span>
        {ETATS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEtat(e.id)}
            title={e.titre}
            style={{
              padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer',
              fontSize: 'var(--crm-text-md)', fontWeight: 500,
              background: etat === e.id ? '#424bfb' : '#1c1c1e', color: '#ffffff',
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* ⚠ La CLÉ force le remontage quand l'état change : ces pages lisent leur
          jeton une fois et gardent leur écran local (landing / upload / booking).
          Sans elle, basculer d'état laisserait la page sur l'écran d'avant, et
          l'on croirait regarder le nouvel état. */}
      <div key={etat}>
        <Routes>
          <Route path="kyc/:token" element={<KycPublicPage />} />
          <Route path="rendez-vous/:token" element={<AppointmentManagePage />} />
          <Route path="reception/:token" element={<BuyerReceptionPage />} />
          <Route path="visite" element={<VisitManagePage />} />
          <Route path="avis" element={<VisitFeedbackPage />} />
          <Route path="invitation/:token" element={<AcceptInvitePage />} />
          <Route
            path="*"
            element={
              <div style={{ padding: 32, color: '#ededed', fontSize: 'var(--crm-text-lg)' }}>
                Choisissez une surface ci-dessus.
              </div>
            }
          />
        </Routes>
      </div>
    </div>
  )
}
