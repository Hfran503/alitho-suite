// Shared helpers for displaying ShipStation rates grouped by carrier account.

interface GroupableRate {
  carrierId?: string | null
  carrier: string
  carrierAccountName?: string | null
  carrierNickname?: string | null
}

export interface CarrierRateGroup<T> {
  key: string
  label: string
  rates: T[]
}

/**
 * Group rates by carrier account (carrierId) so multiple accounts of the same
 * carrier (e.g. two UPS accounts) are kept apart. When a carrier has more than
 * one account, the label adds the account name, e.g. "UPS – Calitho Main",
 * falling back to "UPS (1)", "UPS (2)".
 */
export function groupRatesByCarrierAccount<T extends GroupableRate>(rates: T[]): CarrierRateGroup<T>[] {
  const groups = new Map<string, T[]>()
  for (const rate of rates) {
    const key = rate.carrierId || rate.carrier
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(rate)
  }

  const nameCounts = new Map<string, number>()
  for (const groupRates of groups.values()) {
    const name = groupRates[0].carrier
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
  }

  const seen = new Map<string, number>()
  return Array.from(groups.entries()).map(([key, groupRates]) => {
    const first = groupRates[0]
    const name = first.carrier
    let label = name
    if ((nameCounts.get(name) || 0) > 1) {
      const index = (seen.get(name) || 0) + 1
      seen.set(name, index)
      const account = first.carrierAccountName || first.carrierNickname
      label = account && account !== name ? `${name} – ${account}` : `${name} (${index})`
    }
    return { key, label, rates: groupRates }
  })
}

/** Tailwind grid-cols class for a carrier column layout (max 4 columns). */
export function carrierGridCols(count: number): string {
  return count <= 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-4'
}
