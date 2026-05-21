/**
 * Telegram for **new website orders only** — sent from the storefront at checkout,
 * not from the POS app (see pos-system docs/WEBSITE_ORDERS.md).
 *
 * Flow: `src/pages/Checkout.tsx` → after `addDoc(websiteOrders)` → `notifyWebsiteOrderTelegram`
 * uses `telegramNotificationText` built in `src/utils/cashierPayment.ts`.
 *
 * Chat IDs: per-store list at `users/{ownerId}/onlineOrderTelegramReceivers/config` (POS Admin → Payments).
 * Bot token: global `settings/telegram`. Falls back to `settings/telegram.chatId` if no per-store receivers.
 */
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export type TelegramSettings = {
  botToken: string
  chatId: string
}

export type OnlineOrderTelegramReceiver = {
  storeId: string
  storeName?: string
  telegramChatId: string
}

function getTelegramProxyUrl(): string {
  const envUrl = import.meta.env.VITE_TELEGRAM_PROXY_URL
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim()
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/send-telegram.php`
  }
  return '/send-telegram.php'
}

const normId = (id: unknown) => String(id ?? '').trim()

export async function getTelegramSettings(): Promise<TelegramSettings | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'telegram'))
    if (!snap.exists()) return null
    const data = snap.data()
    const botToken = String(data?.botToken ?? '').trim()
    const chatId = String(data?.chatId ?? '').trim()
    if (!botToken || !chatId) return null
    return { botToken, chatId }
  } catch (err) {
    console.warn('[Telegram] Could not load settings/telegram:', err)
    return null
  }
}

/** Per-store online order receivers (configured in POS Admin → Payments). */
export async function getOnlineOrderTelegramReceivers(
  ownerId: string
): Promise<OnlineOrderTelegramReceiver[]> {
  const oid = normId(ownerId)
  if (!oid) return []
  try {
    const snap = await getDoc(doc(db, 'users', oid, 'onlineOrderTelegramReceivers', 'config'))
    if (!snap.exists()) return []
    const receivers = snap.data()?.receivers
    return Array.isArray(receivers) ? receivers : []
  } catch (err) {
    console.warn('[Telegram] Could not load online order receivers:', err)
    return []
  }
}

/** Chat IDs for a store’s online orders (deduped). Empty if none configured for that store. */
export async function getOnlineOrderTelegramChatIds(
  ownerId: string,
  storeId: string
): Promise<string[]> {
  const sid = normId(storeId)
  if (!sid) return []
  const receivers = await getOnlineOrderTelegramReceivers(ownerId)
  const chatIds = receivers
    .filter((r) => normId(r.storeId) === sid)
    .map((r) => normId(r.telegramChatId))
    .filter(Boolean)
  return [...new Set(chatIds)]
}

type SendOptions = {
  /** Omit or "" for plain text (website orders). Default "HTML" if omitted in PHP; we pass "" explicitly. */
  parseMode?: string
  replyMarkup?: Record<string, unknown> | null
}

/**
 * Send a message via server PHP proxy (avoids CORS on api.telegram.org).
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  options: SendOptions = {}
): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId || !text.trim()) {
    return { success: false, error: 'botToken, chatId, and text are required' }
  }

  const proxyUrl = getTelegramProxyUrl()
  const body: Record<string, unknown> = {
    botToken,
    chatId: String(chatId),
    text,
    parseMode: options.parseMode ?? '',
  }
  if (options.replyMarkup) body.replyMarkup = options.replyMarkup

  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const raw = await response.text()
    let data: { ok?: boolean; description?: string; error?: string }
    try {
      data = JSON.parse(raw) as typeof data
    } catch {
      if (raw.trimStart().startsWith('<') || raw.includes('<?php')) {
        return {
          success: false,
          error:
            'Telegram proxy not available (PHP not running). Set VITE_TELEGRAM_PROXY_URL to your production send-telegram.php URL.',
        }
      }
      return { success: false, error: 'Invalid JSON from Telegram proxy' }
    }

    if (!response.ok) {
      return { success: false, error: data?.error || `Proxy returned ${response.status}` }
    }
    if (!data.ok) {
      return { success: false, error: data.description || data.error || 'Telegram send failed' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

/**
 * Notify Telegram after a website order is saved. Uses telegramNotificationText on the order.
 * Sends to per-store online order receivers (POS Admin → Payments), not payment approvers.
 * Does not throw — checkout should succeed even if Telegram fails.
 */
export async function notifyWebsiteOrderTelegram(
  order: Record<string, unknown>
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const settings = await getTelegramSettings()
  if (!settings?.botToken) {
    return { success: false, skipped: true, error: 'Telegram not configured (settings/telegram botToken)' }
  }

  const text = String(order.telegramNotificationText ?? '').trim()
  if (!text) {
    return { success: false, skipped: true, error: 'No telegramNotificationText on order' }
  }

  const ownerId = normId(order.ownerId)
  const storeId = normId(order.storeId)
  let chatIds = ownerId && storeId ? await getOnlineOrderTelegramChatIds(ownerId, storeId) : []
  if (chatIds.length === 0 && settings.chatId) {
    chatIds = [settings.chatId]
  }
  if (chatIds.length === 0) {
    return {
      success: false,
      skipped: true,
      error:
        'No online order Telegram receivers for this store (POS Admin → Payments → Telegram online orders)',
    }
  }

  let anySuccess = false
  let lastError: string | undefined
  for (const chatId of chatIds) {
    const result = await sendTelegramMessage(settings.botToken, chatId, text, { parseMode: '' })
    if (result.success) anySuccess = true
    else lastError = result.error
  }

  if (!anySuccess) {
    console.warn('[Telegram] Website order notification failed:', lastError)
    return { success: false, error: lastError || 'Telegram send failed' }
  }
  return { success: true }
}
