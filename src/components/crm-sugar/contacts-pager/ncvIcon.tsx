// Icônes line (stroke) de la refonte Contacts — porté 1:1 de `nc-refonte-shared.jsx`
// (NCV_PATHS + NcvIcon). Format SVG stroke, viewBox 24, strokeWidth ~1.8.
// Quelques glyphes ajoutés au set d'origine pour la modale WhatsApp / premier
// lancement : `edit`, `download`, `send` (absents de NCV_PATHS d'origine).

export type NcvIconName =
  | 'user' | 'search' | 'home' | 'flag' | 'building' | 'mail' | 'phone'
  | 'sparkle' | 'doc' | 'check' | 'plus' | 'x' | 'pin' | 'wallet' | 'globe'
  | 'hash' | 'shield' | 'ruler' | 'chevron' | 'calendar' | 'bag' | 'camera'
  | 'edit' | 'download' | 'send'

const NCV_PATHS: Record<NcvIconName, string> = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6.2 8-6.2S20 16 20 20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4h11l-2 3.2 2 3.2H6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7.5l8 5.5 8-5.5"/>',
  phone: '<path d="M5 4h3l1.8 4.6-2 1.4a11 11 0 0 0 5.2 5.2l1.4-2 4.6 1.8V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  sparkle: '<path d="M12 3l1.9 5.4L19.5 10l-5.6 1.6L12 17l-1.9-5.4L4.5 10l5.6-1.6z"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12.5h5M9.5 16h5"/>',
  check: '<path d="M5 12.5l4 4 10-10"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/><circle cx="16.5" cy="14.5" r="1.3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.6 3 14.4 0 18M12 3c-3 3.6-3 14.4 0 18"/>',
  hash: '<path d="M9.5 4l-2 16M16.5 4l-2 16M5 9h15M4 15h15"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.6 8-8 9-4.4-1-8-4-8-9V6z"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  chevron: '<path d="M6 9.5l6 6 6-6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  camera: '<path d="M4 9a2 2 0 0 1 2-2h1.6l1.1-1.7A1 1 0 0 1 9.6 4.8h4.8a1 1 0 0 1 .84.5L16.4 7H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.6" r="3.3"/>',
  // ── Ajouts (hors set NCV d'origine) ──────────────────────────────────
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  send: '<path d="M22 3L11 14"/><path d="M22 3l-7 18-4-8-8-4z"/>',
}

export function NcvIcon({
  name,
  size = 16,
  stroke = '#0B0C0E',
  sw = 1.8,
}: {
  name: NcvIconName
  size?: number
  stroke?: string
  sw?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: NCV_PATHS[name] || '' }}
    />
  )
}
