/**
 * Google Analytics 4 (GA4) integration.
 * Base gtag script is in index.html. This util sends page views and events.
 */

const MEASUREMENT_ID = 'G-PTY9KH37DK'

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string,
      params?: Record<string, unknown>
    ) => void
    dataLayer?: unknown[]
  }
}

export function initAnalytics(): void {
  /* No-op: gtag loaded via index.html */
}

export function trackPageView(path: string, title?: string): void {
  if (!window.gtag) return
  window.gtag('config', MEASUREMENT_ID, {
    page_path: path,
    page_title: title || document.title,
  })
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!window.gtag) return
  window.gtag('event', eventName, params)
}

export const isAnalyticsEnabled = true
