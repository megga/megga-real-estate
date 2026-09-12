// MEGGA — Le rapport KYC entier : polices, règles d'impression, trois feuilles.
//
// Un seul composant pour les DEUX routes qui le montent — l'aperçu de l'agent
// (`/dashboard/kyc/:id/export`, Cmd+P) et le rendu headless tokenisé
// (`/kyc-report/:token`, capturé par Cloudflare Browser Rendering pour WhatsApp).
// C'est ce qui garantit que le PDF envoyé est le PDF vu : même template, mêmes
// polices, mêmes règles `@page`.
//
// ⚠ Caveat (la signature) n'est PAS chargée par `index.html` — le CRM n'en a pas
// l'usage ; Manrope l'est, mais le lien est redit ici pour que le rendu headless
// ne dépende pas de l'ordre de chargement du shell. `document.fonts.ready`, que
// les deux routes attendent avant d'imprimer, couvre ce lien-ci.

import { PdfPage1 } from './PdfPage1'
import { PdfPage2 } from './PdfPage2'
import { PdfPage3 } from './PdfPage3'
import { PDF } from './tokens'
import type { PdfReportData } from './buildReportData'

interface Props {
  data: PdfReportData
}

export function KycReportDocument({ data }: Props) {
  return (
    <>
      <link
        rel="stylesheet"
        referrerPolicy="no-referrer"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Caveat:wght@500&display=swap"
      />
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: ${PDF.paper} !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .pdf-page { box-shadow: none !important; break-after: page; page-break-after: always; }
          .pdf-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <PdfPage1 data={data} />
      <PdfPage2 data={data} />
      <PdfPage3 data={data} />
    </>
  )
}
