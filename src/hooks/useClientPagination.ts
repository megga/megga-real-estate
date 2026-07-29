/**
 * Pagination côté client d'une liste déjà chargée.
 *
 * Les listes de la console filtrent et paginent en mémoire : les volumes sont
 * ceux d'une plateforme, pas d'un catalogue. Le trio « total de pages / page
 * bornée / tranche courante » était recopié à l'identique dans cinq écrans, avec
 * chaque fois le même piège — la page courante doit être BORNÉE au nombre de
 * pages, sinon filtrer une liste déjà paginée laisse l'utilisateur sur une page
 * qui n'existe plus, donc devant du vide.
 */
import { useMemo, useState } from 'react'

export interface ClientPagination<T> {
  /** Page effectivement affichée : bornée à `totalPages`, jamais au-delà. */
  page: number
  setPage: (page: number | ((prev: number) => number)) => void
  totalPages: number
  /** Tranche de `items` correspondant à `page`. */
  paginated: T[]
  /** Taille de page, rendue pour les libellés « 1–10 sur 42 ». */
  perPage: number
  total: number
}

/**
 * Découpe `items` en pages de `perPage`.
 *
 * `setPage` reste exposé : les écrans le remettent à 1 quand un filtre change,
 * sans quoi on resterait sur une page vide d'un résultat plus court.
 */
export function useClientPagination<T>(items: T[], perPage: number): ClientPagination<T> {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / perPage))
  const safePage = Math.min(page, totalPages)

  const paginated = useMemo(
    () => items.slice((safePage - 1) * perPage, safePage * perPage),
    [items, safePage, perPage],
  )

  return { page: safePage, setPage, totalPages, paginated, perPage, total: items.length }
}
