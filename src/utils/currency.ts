/** Format amount in Ghana cedis (GHS). No decimals, comma-separated thousands. */
export function formatCedi(amount: number): string {
  return `GH₵${Math.round(amount).toLocaleString()}`
}
