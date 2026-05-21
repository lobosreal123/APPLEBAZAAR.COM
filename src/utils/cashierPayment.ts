import { formatCedi } from './currency'

export const MOBILE_MONEY_NUMBER = '0544874507'
export const MOBILE_MONEY_NAME = 'Lobos iOS Unlocking Ventures or Ibrahim Mohammed'

export type CashierPaymentDetails = {
  method: 'Mobile Money' | 'Cash'
  status: 'unpaid' | 'paid' | 'partial'
  currency: string
  orderTotal: number
  amountPaid: number
  balanceDue: number
  isPartialPayment: boolean
  cartSubtotal?: number
  totalAmountSentByCustomer?: number
  payToMobileNumber?: string
  payToAccountName?: string
  paymentReference?: string
  senderName?: string
  cashInstructions?: string
  summaryLines: string[]
}

type BuildArgs = {
  paymentMethod: 'Mobile Money' | 'Cash'
  orderTotal: number
  paidAmount: number
  cartSubtotal: number
  currency: string
  mobileMoney?: {
    paymentReference: string
    senderName: string
    amountSentTotal: number
  }
}

/** Remove undefined values — Firestore rejects undefined on any field. */
export function omitUndefined<T>(value: T): T {
  if (value === undefined) return value
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefined(item)) as T
  }
  if (value instanceof Date) return value
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined) continue
    out[key] = omitUndefined(val)
  }
  return out as T
}

export function buildCashierPaymentDetails(args: BuildArgs): CashierPaymentDetails {
  const { paymentMethod, orderTotal, paidAmount, cartSubtotal, currency } = args
  const balanceDue = Math.max(0, Math.round((orderTotal - paidAmount) * 100) / 100)
  const isPartialPayment =
    paymentMethod === 'Mobile Money' && paidAmount > 0 && paidAmount < orderTotal - 0.001
  const status: CashierPaymentDetails['status'] =
    paymentMethod === 'Cash'
      ? 'unpaid'
      : paidAmount >= orderTotal - 0.001
        ? 'paid'
        : paidAmount > 0
          ? 'partial'
          : 'unpaid'

  const summaryLines: string[] = [
    '—— Payment (for cashier) ——',
    `Method: ${paymentMethod}`,
    `Status: ${status}`,
    `Order total: ${formatCedi(orderTotal)}`,
  ]

  const details: CashierPaymentDetails = {
    method: paymentMethod,
    status,
    currency,
    orderTotal,
    amountPaid: paidAmount,
    balanceDue,
    isPartialPayment,
    summaryLines,
  }

  if (cartSubtotal !== orderTotal) {
    details.cartSubtotal = cartSubtotal
  }

  if (paymentMethod === 'Cash') {
    details.cashInstructions =
      'Customer will pay cash at the shop. Confirm payment before delivery.'
    summaryLines.push(details.cashInstructions)
    return details
  }

  const mm = args.mobileMoney
  if (mm) {
    details.totalAmountSentByCustomer = mm.amountSentTotal
    details.payToMobileNumber = MOBILE_MONEY_NUMBER
    details.payToAccountName = MOBILE_MONEY_NAME
    details.paymentReference = mm.paymentReference
    details.senderName = mm.senderName
    summaryLines.push(`Amount paid (this order): ${formatCedi(paidAmount)}`)
    if (balanceDue > 0) {
      summaryLines.push(`Balance due: ${formatCedi(balanceDue)}`)
    }
    summaryLines.push(`Total sent by customer: ${formatCedi(mm.amountSentTotal)}`)
    if (cartSubtotal !== orderTotal) {
      summaryLines.push(`Full cart subtotal: ${formatCedi(cartSubtotal)}`)
    }
    summaryLines.push(`Payment reference: ${mm.paymentReference}`)
    summaryLines.push(`Sender name: ${mm.senderName}`)
    summaryLines.push(`Pay to number: ${MOBILE_MONEY_NUMBER}`)
    summaryLines.push(`Pay to name: ${MOBILE_MONEY_NAME}`)
    if (isPartialPayment) {
      summaryLines.push(
        'Partial payment: customer agreed to pay balance at shop or send full amount before delivery.'
      )
    } else {
      summaryLines.push('Full payment entered. Verify transaction before confirming order.')
    }
  }

  return details
}

/** Plain-text payment block for Telegram / POS notifications. */
export function formatPaymentDetailsForTelegram(details: CashierPaymentDetails): string {
  return details.summaryLines.join('\n')
}

type TelegramOrderArgs = {
  storeName: string
  orderNumber: string
  customerName: string
  customerPhone?: string
  items: { name: string; quantity: number; price: number; cashierNote?: string }[]
  total: number
  currency: string
  paymentText: string
}

/** Full Telegram body: shop placing the order + items + payment (POS can send as-is). */
export function buildTelegramOrderNotification(args: TelegramOrderArgs): string {
  const lines: string[] = [
    '🛒 New website order',
    `Shop: ${args.storeName}`,
    `Order: ${args.orderNumber}`,
    `Customer: ${args.customerName}`,
  ]
  if (args.customerPhone?.trim()) lines.push(`Phone: ${args.customerPhone.trim()}`)
  lines.push('', 'Items:')
  for (const it of args.items) {
    let line = `• ${it.name} × ${it.quantity} — ${formatCedi(it.price * it.quantity)}`
    if (it.cashierNote?.trim()) line += `\n  Note: ${it.cashierNote.trim()}`
    lines.push(line)
  }
  lines.push('', `Total: ${formatCedi(args.total)} ${args.currency}`)
  lines.push('', args.paymentText)
  return lines.join('\n')
}
