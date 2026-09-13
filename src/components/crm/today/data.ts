// MEGGA CRM — Refonte « Aujourd'hui » · reliquat du prototype (today-redesign-kit.jsx).
// ----------------------------------------------------------------------------
// Il ne reste que `fmtCHF` et les photos d'exemple de la DÉMO. Le jeu `DATA`
// (agenda, pipeline, focus… et l'agent « Gregory ») est parti le 13.09.2026 : son
// dernier lecteur était le repli du prénom de la salutation, qui faisait dire
// « Bonjour Gregory » à tout profil sans nom.
//
// ⛔ `PHOTO` ne sert que les données de démonstration : jamais de repli pour un
// bien réel sans photo (voir `CatImg`, PageCatalogue.tsx).

export const fmtCHF = (n: number): string =>
  'CHF ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")

export const PHOTO = {
  carouge: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1000&q=80',
  champel: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000&q=80',
  cologny: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000&q=80',
  eauxvives: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000&q=80',
}
