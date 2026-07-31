// Documents légaux exigés par le CRM (nLPD).
//
// ⚠ Les VERSIONS ne vivent plus ici. Elles sont en base — table
// `legal_document_versions`, migration 20260731140000 — et remontent par la RPC
// `pending_consents()`. Une constante de bundle ne pouvait pas servir de source
// de vérité : le trigger d'inscription (`handle_new_user`), qui écrit désormais
// la preuve dès la création du compte, ne la voyait pas, et un client pouvait
// déclarer la version de son choix à `record_consent`.

export type RequiredConsentType = 'terms' | 'privacy'

/**
 * Pages légales servies par la vitrine (sites/megga-vitrine).
 *
 * `terms` pointait sur `/mentions-legales.html`, qui redirige vers `/legal` —
 * les mentions légales, pas les conditions générales. Le libellé de la case
 * promettait donc un document et le lien en ouvrait un autre.
 */
export const LEGAL_URLS: Record<RequiredConsentType, string> = {
  terms: 'https://megga.ch/terms',
  privacy: 'https://megga.ch/privacy',
}
