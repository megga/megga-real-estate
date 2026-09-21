/**
 * Le compteur WhatsApp, côté navigateur : combien de messages MEGGA a envoyés dans un
 * mois — à l'agent (les échanges avec MEGGA AI, point du jour compris) et aux clients.
 * Lectures pures des deux RPC de `20260921120000_whatsapp_usage.sql`.
 *
 * ⚠ Pourquoi compter : depuis le 01.10.2026, Meta facture aussi les réponses envoyées
 * dans les 24 h qui suivent un message de l'agent — le gros du trafic du copilote, jusque-là
 * gratuit. Un futur quota par plan s'appuiera sur ce compteur ; il faut donc qu'il existe,
 * et qu'il soit juste, AVANT de fixer le quota.
 *
 * ⛔ L'agence ne reçoit que des VOLUMES. Ce que Meta facture, et dans quelle catégorie, ne
 * se lit que dans la console super-admin : c'est la structure de coût de MEGGA, et l'agence
 * paie MEGGA, pas Meta — même règle que les crédits (`credits-confidentialite.spec.ts`).
 */

/** Le mois d'une agence, tel que `whatsapp_usage_month` le rend. Mois UTC, comme les crédits. */
export interface WhatsAppUsage {
  /** `YYYY-MM`. */
  month: string
  /** Messages envoyés à un agent : réponses de MEGGA AI, confirmations, point du jour. */
  agent: number
  /** Messages envoyés à un client : relances, biens, rappels, KYC. */
  client: number
  /**
   * Sortants sans audience. Zéro par construction — la garde d'envoi la pose, et la
   * migration a rattrapé l'historique —, mais compté plutôt que tu : un total qui ne
   * boucle pas se voit, un chiffre avalé non.
   */
  unclassified: number
}

const entier = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function whatsappUsageFromJson(j: unknown): WhatsAppUsage {
  const o = (j ?? {}) as Record<string, unknown>
  return {
    month: typeof o.month === 'string' ? o.month : '',
    agent: entier(o.agent),
    client: entier(o.client),
    unclassified: entier(o.unclassified),
  }
}

// ─── La console ──────────────────────────────────────────────────────────────

/** Une ligne de `get_admin_whatsapp_usage` : un mois × une agence. */
export interface AdminWhatsAppUsageRow {
  month: string
  /** `null` = envoi sans agence (accusé STOP d'un numéro inconnu…). */
  agencyId: string | null
  agencyName: string | null
  agentMessages: number
  clientMessages: number
  delivered: number
  /** Facturés par Meta : `billable` ET livrés. Meta ne facture qu'à la livraison. */
  billable: number
  /** Livrés, par catégorie FACTURÉE par Meta (`marketing`, `utility`, `service`…). */
  byCategory: Record<string, number>
}

export function adminWhatsAppUsageFromRow(r: {
  month: string; agency_id: string | null; agency_name: string | null
  agent_messages: number; client_messages: number; delivered: number; billable: number; by_category: unknown
}): AdminWhatsAppUsageRow {
  const cats: Record<string, number> = {}
  if (r.by_category && typeof r.by_category === 'object' && !Array.isArray(r.by_category)) {
    for (const [k, v] of Object.entries(r.by_category as Record<string, unknown>)) {
      const n = entier(v)
      if (n > 0) cats[k] = n
    }
  }
  return {
    month: r.month,
    agencyId: r.agency_id,
    agencyName: r.agency_name,
    agentMessages: entier(r.agent_messages),
    clientMessages: entier(r.client_messages),
    delivered: entier(r.delivered),
    billable: entier(r.billable),
    byCategory: cats,
  }
}

/**
 * Les catégories Meta d'une ligne, du plus gros volume au plus petit — `marketing` coûte
 * plusieurs fois `utility`, et c'est d'abord lui qu'on vient chercher. À égalité, l'ordre
 * alphabétique : deux rendus du même mois ne doivent pas permuter.
 */
export function categoriesParVolume(byCategory: Record<string, number>): Array<[string, number]> {
  return Object.entries(byCategory).sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
}

/** Les totaux d'un mois, toutes agences confondues — la ligne de tendance de la console. */
export function totauxParMois(rows: AdminWhatsAppUsageRow[]): Array<{ month: string; sent: number; billable: number }> {
  const parMois = new Map<string, { sent: number; billable: number }>()
  for (const r of rows) {
    const t = parMois.get(r.month) ?? { sent: 0, billable: 0 }
    t.sent += r.agentMessages + r.clientMessages
    t.billable += r.billable
    parMois.set(r.month, t)
  }
  return [...parMois.entries()]
    .sort((a, z) => z[0].localeCompare(a[0]))
    .map(([month, t]) => ({ month, ...t }))
}
