// Appairage WhatsApp de l'agent : génère un code à 6 chiffres, l'agent l'envoie
// au numéro MEGGA depuis SON WhatsApp → le webhook le vérifie. Lecture seule (Phase 3).

import { useWhatsAppPairing } from '@/hooks/useWhatsAppPairing'

const MEGGA_WA_NUMBER = '+1 555 657 2763' // numéro test Meta (à remplacer par le n° prod)

export function WhatsAppPairingCard() {
  const { status, generateCode } = useWhatsAppPairing()
  const link = status.data

  return (
    <div className="rounded-xl border border-theme-border bg-theme-card p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-theme-primary">MEGGA AI sur WhatsApp</h3>
        {link?.verified && <span className="text-xs text-emerald-500">● Lié</span>}
      </div>

      {link?.verified ? (
        <p className="text-xs text-theme-muted">
          Votre WhatsApp ({link.wa_number}) est lié. Écrivez à MEGGA au {MEGGA_WA_NUMBER} :
          « Mes RDV demain ? », « Résume le dossier Dubois ».
        </p>
      ) : (
        <>
          <p className="text-xs text-theme-muted mb-3">
            Liez votre WhatsApp pour interroger MEGGA AI directement depuis votre téléphone.
            Générez un code, puis envoyez-le à MEGGA au <strong>{MEGGA_WA_NUMBER}</strong>.
          </p>

          {link?.pairing_code ? (
            <div className="mb-3">
              <div className="text-2xl font-semibold tracking-widest text-theme-primary">{link.pairing_code}</div>
              <p className="text-xs text-theme-muted mt-1">
                Envoyez ce code à {MEGGA_WA_NUMBER} sur WhatsApp (valable 15 min).
              </p>
            </div>
          ) : null}

          <button
            onClick={() => generateCode.mutate()}
            disabled={generateCode.isPending}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:border-theme-border-strong transition-colors disabled:opacity-50"
          >
            {generateCode.isPending ? 'Génération…' : link?.pairing_code ? 'Régénérer un code' : 'Générer un code'}
          </button>
        </>
      )}
    </div>
  )
}
