import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export type TelegramSettings = {
  botToken: string
  chatId: string
}

function getTelegramProxyUrl(): string {
  const envUrl = import.meta.env.VITE_TELEGRAM_PROXY_URL
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim()
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/send-telegram.php`
  }
  return '/send-telegram.php'
}

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
 * Does not throw — checkout should succeed even if Telegram fails.
 */
export async function notifyWebsiteOrderTelegram(
  order: Record<string, unknown>
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const settings = await getTelegramSettings()
  if (!settings) {
    return { success: false, skipped: true, error: 'Telegram not configured (settings/telegram)' }
  }

  const text = String(order.telegramNotificationText ?? '').trim()
  if (!text) {
    return { success: false, skipped: true, error: 'No telegramNotificationText on order' }
  }

  const result = await sendTelegramMessage(settings.botToken, settings.chatId, text, {
    parseMode: '',
  })
  if (!result.success) {
    console.warn('[Telegram] Website order notification failed:', result.error)
  }
  return result
}
