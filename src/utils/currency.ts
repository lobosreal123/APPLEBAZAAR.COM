/** Format amount in Ghana cedis (GHS). No decimals. */
export function formatCedi(amount: number): string {
  return `GH₵${Math.round(amount)}`
}
