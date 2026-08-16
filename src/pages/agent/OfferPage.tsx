// MEGGA CRM — Route plein écran de la modale Offre / Contre-offre.
// Wrapper mince autour de <OfferModalSugar> (page unique, handoff Claude Design).
//
// Routes :
//   /dashboard/transactions/:id/offre/nouvelle → offer  (acheteur)
//   /dashboard/transactions/:id/offre/contre   → counter (vendeur, basé dernière offre)
//
// La logique (single-page, dark, submit branché useCreateOffer) vit dans
// OfferModalSugar, aussi embarquée `contained` dans la fiche Deal V3.

import { Navigate, useNavigate, useParams } from 'react-router-dom'
import OfferModalSugar from '@/components/crm-sugar-v3/offer-modal/OfferModalSugar'
import { useOfferChain, lastOffer } from '@/hooks/useOffers'
import { useSugarDark } from '@/lib/sugarDark'
import type { OfferKind } from '@/types/offer'

export default function OfferPage() {
  const { id, kind: rawKind } = useParams<{ id: string; kind: string }>()
  const navigate = useNavigate()
  const dark = useSugarDark()
  const kind: OfferKind = rawKind === 'contre' ? 'counter' : 'offer'

  const { data: chain } = useOfferChain(id)
  const parentOffer = kind === 'counter' ? lastOffer(chain) ?? null : null

  const back = () => {
    if (id) navigate(`/dashboard/transactions/${id}`)
    else navigate('/dashboard/pipeline')
  }

  if (!id) return <Navigate to="/dashboard/pipeline" replace />

  return (
    <OfferModalSugar
      dealId={id}
      kind={kind}
      parentOffer={parentOffer}
      dark={dark}
      contained={false}
      onClose={back}
    />
  )
}
