/**
 * POS inventory "named prices" (up to 4 tiers).
 * A tier is sellable when it has a name + positive price and is not disabled.
 * The 4th option may carry MOQ and an on/off toggle.
 */

export const MAX_NAMED_PRICES = 4
export const MOQ_PRICE_OPTION_INDEX = 3

export type NamedPrice = {
  name: string
  price: number
  moq?: number
  enabled?: boolean
}

const toNumber = (value: unknown): number => {
  if (value === '' || value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export const toMoq = (value: unknown): number => {
  if (value === '' || value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseInt(String(value).replace(/,/g, ''), 10)
  if (!Number.isFinite(n) || n < 1) return 0
  return Math.floor(n)
}

export const isPriceOptionEnabled = (option: NamedPrice | undefined): boolean =>
  option?.enabled !== false

export function normalizeNamedPrices(raw: unknown): NamedPrice[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p, index) => {
      const entry: NamedPrice = {
        name: String((p as NamedPrice)?.name ?? '').trim(),
        price: toNumber((p as NamedPrice)?.price),
      }
      const moq = toMoq((p as NamedPrice)?.moq)
      if (moq > 0) entry.moq = moq
      if (index === MOQ_PRICE_OPTION_INDEX && (p as NamedPrice)?.enabled === false) {
        entry.enabled = false
      }
      return entry
    })
    .filter((p) => p.name !== '' || p.price > 0)
    .slice(0, MAX_NAMED_PRICES)
}

/** Tiers shown/sellable on the website (same rules as POS). */
export function getActiveNamedPrices(raw: unknown): NamedPrice[] {
  return normalizeNamedPrices(raw).filter(
    (p) => p.name !== '' && p.price > 0 && isPriceOptionEnabled(p)
  )
}

export function getNamedPriceMoq(option: NamedPrice | undefined): number {
  return toMoq(option?.moq)
}

/** Lowest active named price, or base price when none. */
export function getDisplayPrice(basePrice: number, namedPrices?: NamedPrice[]): number {
  const active = (namedPrices ?? []).filter((p) => p.name && p.price > 0)
  if (active.length === 0) return basePrice
  return Math.min(...active.map((p) => p.price))
}
