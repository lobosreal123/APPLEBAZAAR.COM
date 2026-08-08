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

/** Telegram money format (matches POS Online Orders: ₵120). */
function formatTelegramCedi(amount: number): string {
  const rounded = Math.round(amount)
  return `₵${rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export type WebsitePaymentTelegramInput = {
  paymentMethod: 'Mobile Money' | 'Cash'
  paymentStatus: string
  paidAmount: number
  orderTotal: number
  paymentReference?: string
  paymentSenderName?: string
  cashierPaymentDetails?: CashierPaymentDetails
}

function paymentStatusHeadline(status: string): string {
  const s = status.toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'partial') return 'Partial'
  if (s === 'unpaid') return 'Unpaid'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** e.g. Payment status: Paid✅ */
function formatTelegramPaymentStatusLine(status: string): string {
  const label = paymentStatusHeadline(status)
  const s = status.toLowerCase()
  if (s === 'paid') return `Payment status: ${label}✅`
  return `Payment status: ${label}`
}

function formatTelegramDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function collectCustomerNotes(items: { cashierNote?: string }[]): string {
  const notes = items.map((i) => i.cashierNote?.trim()).filter((n): n is string => Boolean(n))
  return [...new Set(notes)].join(', ')
}

/** Item line total without ₵ prefix (e.g. “— 120”). */
function formatTelegramItemTotal(amount: number): string {
  return String(Math.round(amount))
}

/**
 * Payment lines for Telegram (after items): Method, Payment status, Paid Amount, etc.
 */
export function formatWebsitePaymentForTelegram(input: WebsitePaymentTelegramInput): string {
  const cpd = input.cashierPaymentDetails
  const method = input.paymentMethod || cpd?.method || ''
  const status = (input.paymentStatus || cpd?.status || 'unpaid').toLowerCase()
  const paidRaw =
    input.paidAmount != null ? input.paidAmount : cpd?.amountPaid != null ? cpd.amountPaid : 0
  const totalRaw =
    input.orderTotal != null ? input.orderTotal : cpd?.orderTotal != null ? cpd.orderTotal : 0
  const reference = (input.paymentReference || cpd?.paymentReference || '').trim()
  const sender = (input.paymentSenderName || cpd?.senderName || '').trim()

  const lines: string[] = []
  if (method) lines.push(`Method: ${method}`)
  lines.push(formatTelegramPaymentStatusLine(status))
  lines.push(`Paid Amount: ${formatTelegramCedi(paidRaw)}`)
  lines.push(`Order total: ${formatTelegramCedi(totalRaw)}`)
  if (reference) lines.push(`Payment reference: ${reference}`)
  if (sender) lines.push(`Sender name: ${sender}`)
  return lines.join('\n')
}

/** @deprecated Use formatWebsitePaymentForTelegram */
export function formatPaymentDetailsForTelegram(details: CashierPaymentDetails): string {
  return formatWebsitePaymentForTelegram({
    paymentMethod: details.method,
    paymentStatus: details.status,
    paidAmount: details.amountPaid,
    orderTotal: details.orderTotal,
    paymentReference: details.paymentReference,
    paymentSenderName: details.senderName,
    cashierPaymentDetails: details,
  })
}

type TelegramOrderArgs = {
  storeName: string
  ownerId: string
  orderNumber: string
  createdAt: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  items: { name: string; quantity: number; price: number; cashierNote?: string; priceName?: string }[]
  total: number
  currency: string
  paymentMethod: 'Mobile Money' | 'Cash'
  paymentStatus: string
  paidAmount: number
  orderTotal: number
  paymentReference?: string
  paymentSenderName?: string
  cashierPaymentDetails: CashierPaymentDetails
}

const TELEGRAM_ORDER_FOOTER =
  '🤝verify all details before accepting and proceeding order thanks'

/** Full Telegram body (POS-style layout). */
export function buildTelegramOrderNotification(args: TelegramOrderArgs): string {
  const lines: string[] = [
    '🛒 New online order',
    '',
    `🏪 Shop: ${args.storeName}`,
    `🆔 Shop UID: ${args.ownerId}`,
    `📋 Order: #${args.orderNumber.replace(/^#+/, '')}`,
    `📅 Date: ${formatTelegramDate(args.createdAt)}`,
    '',
    '👤 Customer',
    `• Name: ${args.customerName}`,
    `• Phone: ${args.customerPhone?.trim() || '—'}`,
    `• Email: ${args.customerEmail?.trim() || '—'}`,
    `• Address: ${args.customerAddress?.trim() || '—'}`,
  ]

  const customerNote = collectCustomerNotes(args.items)
  if (customerNote) {
    lines.push(`📝Customer note: ${customerNote}`)
  }

  lines.push('', '📦 Items')
  for (const it of args.items) {
    const label = it.priceName ? `${it.name} (${it.priceName})` : it.name
    lines.push(
      `• ${label} × ${it.quantity} — ${formatTelegramItemTotal(it.price * it.quantity)}`
    )
  }

  lines.push('')
  lines.push(
    formatWebsitePaymentForTelegram({
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentStatus,
      paidAmount: args.paidAmount,
      orderTotal: args.orderTotal,
      paymentReference: args.paymentReference,
      paymentSenderName: args.paymentSenderName,
      cashierPaymentDetails: args.cashierPaymentDetails,
    })
  )

  const cur = args.currency?.trim() || 'GHS'
  lines.push('', `💰 Total: ${Math.round(args.total)} ${cur}`, '', TELEGRAM_ORDER_FOOTER)
  return lines.join('\n')
}
