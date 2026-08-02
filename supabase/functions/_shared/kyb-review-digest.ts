// supabase/functions/_shared/kyb-review-digest.ts
//
// Composition du digest quotidien des dossiers KYB en attente de revue humaine.
//
// POURQUOI CE FICHIER EXISTE SEPAREMENT de l'edge function qui envoie. Module PUR : aucun
// import, aucun Deno.env.get, aucun fetch -- meme discipline que
// _shared/agency-verification-notice.ts, donc les libelles se verifient depuis vitest sans
// pile Deno ni cle Resend.
//
// POURQUOI UN DIGEST, ET PAS UNE ALERTE PAR DOSSIER. Un courriel par soumission ferait du
// bruit a l'echelle ou l'on veut arriver, et se ferait filtrer. Un point par jour, qui ne
// part QUE s'il y a quelque chose a dire, reste lisible et garde sa valeur de signal.
//
// POURQUOI CE SIGNAL EXISTE. Audit d'onboarding du 01.08.2026 : le veto `id_document`
// n'accepte que 'match', aucun connecteur ne le produit, seule admin_resolve_agency_id_document
// (humaine) le pose -- donc AUCUN dossier, d'AUCUN pays, ne peut s'auto-valider. Le passage
// humain n'est pas un cas de bord, c'est le chemin unique. Rien n'allait chercher le relecteur.

/** Un dossier en attente, tel que le rend la RPC kyb_review_digest_payload(). */
export interface PendingDossier {
  agency_id: string
  agency_name: string
  country: string | null
  /** null = le moteur n'a pu scorer aucun check (cas courant : les sources scorables sortent
   *  toutes 'unavailable'). Distinct d'un score de 0, qui serait un verdict defavorable. */
  score: number | null
  submitted_at: string
  age_days: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Le sujet porte le nombre ET l'anciennete du plus ancien : c'est ce qui decide de l'ouverture
 *  d'un courriel quotidien. « Revue KYB : 3 dossiers » sans anciennete se lit pareil le premier
 *  jour et le dixieme. */
export function digestSubject(count: number, oldestAgeDays: number): string {
  const dossiers = count === 1 ? '1 dossier' : `${count} dossiers`
  if (oldestAgeDays < 1) return `Revue KYB : ${dossiers} en attente`
  const jours = oldestAgeDays === 1 ? '1 jour' : `${oldestAgeDays} jours`
  return `Revue KYB : ${dossiers} en attente, le plus ancien depuis ${jours}`
}

/**
 * Compose sujet et corps. `null` quand il n'y a rien a signaler : un digest quotidien qui
 * arrive tous les jours pour dire « rien » se fait ignorer, puis filtrer, et n'est plus lu le
 * jour ou il compte.
 *
 * Le nom d'agence est ECHAPPE : texte libre saisi a l'inscription, rendu dans du HTML.
 */
export function buildReviewDigest(input: {
  dossiers: PendingDossier[]
  appUrl: string
}): { subject: string; html: string } | null {
  if (input.dossiers.length === 0) return null

  const oldest = Math.max(...input.dossiers.map((d) => d.age_days))
  const subject = digestSubject(input.dossiers.length, oldest)

  const lignes = input.dossiers
    .map((d) => {
      const score = d.score === null ? 'non calcule' : d.score.toFixed(3)
      const anciennete = d.age_days < 1 ? "aujourd'hui" : d.age_days === 1 ? 'depuis 1 jour' : `depuis ${d.age_days} jours`
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">
            ${escapeHtml(d.agency_name)}
            <span style="color:#9ca3af;font-size:12px;"> ${escapeHtml(d.country ?? '--')}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:nowrap;">
            ${escapeHtml(anciennete)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:nowrap;">
            ${escapeHtml(score)}
          </td>
        </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">MEGGA</span>
      <span style="font-size:11px;color:#9ca3af;display:block;margin-top:2px;">Console super-admin</span>
    </div>

    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;padding:28px;">
      <h2 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 8px 0;">${escapeHtml(subject)}</h2>
      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 20px 0;">
        Ces agences ne peuvent ouvrir aucun dossier KYC client tant que leur identite n'a pas ete tranchee.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:0 0 22px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding:0 12px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;">Agence</th>
            <th style="text-align:left;padding:0 12px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;">En attente</th>
            <th style="text-align:left;padding:0 12px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;">Score</th>
          </tr>
        </thead>
        <tbody>${lignes}
        </tbody>
      </table>

      <a href="${escapeHtml(input.appUrl)}/dashboard/admin/kyb-review"
         style="display:inline-block;background:#1a1a1a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px;">
        Ouvrir la file de revue
      </a>
    </div>

    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:24px 0 0 0;">
      Message automatique, envoye une fois par jour uniquement lorsqu'au moins un dossier attend.
    </p>
  </div>
</body>
</html>`

  return { subject, html }
}
