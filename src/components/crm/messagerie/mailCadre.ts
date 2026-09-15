/**
 * Le CADRE de la Messagerie — le « pager », la carte arrondie `data-mail-bento` —, tel
 * que ses modales doivent l'épouser.
 *
 * « Le flou doit épouser le pager, et non pas partout dans l'écran » (Julien,
 * 14.09.2026). Les sept modales se portaient dans `<body>`, en plein écran : le voile
 * floutait aussi la barre latérale et la bande d'onglets, qui ne sont pas concernées.
 * `MessagerieApp` publie ici son cadre ; `MailModalShell` s'y monte, en `absolute`, et
 * suit donc de lui-même un redimensionnement ou l'ouverture du dock — aucune mesure.
 *
 * `null` hors de la Messagerie (aucun fournisseur) : la coquille retombe sur le plein
 * écran d'avant.
 */
import { createContext } from 'react'

export const MailCadreContext = createContext<HTMLElement | null>(null)
