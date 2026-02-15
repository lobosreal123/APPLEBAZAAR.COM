/** Format amount in Ghana cedis (GHS). */
export function formatCedi(amount: number): string {
  return `GH₵${amount.toFixed(2)}`
}
