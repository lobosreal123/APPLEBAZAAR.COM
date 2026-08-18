/**
 * Sickw.com IMEI checking (same account/API as POS Free Check).
 * Uses a server proxy to avoid CORS.
 */
function getSickwProxyUrl(): string {
  const envUrl = import.meta.env.VITE_SICKW_PROXY_URL
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim().replace(/\/$/, '')
  if (import.meta.env.DEV) return '/api/sickw'
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api-proxy.php`
  }
  return '/api-proxy.php'
}

export function getSickwAPIKey(): string | null {
  const apiKey = (import.meta.env.VITE_SICKW_API_KEY as string | undefined)?.trim()
  return apiKey || null
}

export type SickwService = {
  service: string
  name: string
  price?: string | number
}

export type ImeiCheckResult = {
  success: boolean
  error?: string
  imei?: string | null
  imei2?: string | null
  meid?: string | null
  serialNumber?: string | null
  identifier?: string
  identifierType?: string
  modelDescription?: string | null
  model?: string | null
  modelCode?: string | null
  brand?: string | null
  storage?: string | null
  color?: string | null
  iCloudLock?: string | null
  iCloudStatus?: string | null
  fmiStatus?: string | null
  simLockStatus?: string | null
  lockedCarrier?: string | null
  activationStatus?: string | null
  registrationStatus?: string | null
  warrantyStatus?: string | null
  telephoneSupport?: string | null
  repairsServiceCoverage?: string | null
  estimatedPurchaseDate?: string | null
  appleCareEligible?: string | null
  mdmStatus?: string | null
  mdmEnrollment?: string | null
  supervisionStatus?: string | null
  demoUnit?: string | null
  refurbishedDevice?: string | null
  serviceId?: string | null
  balance?: string | null
  price?: string | null
  [key: string]: unknown
}

export async function getServices(apiKey: string): Promise<SickwService[]> {
  if (!apiKey) throw new Error('API key is required')
  const baseUrl = getSickwProxyUrl()
  const url = `${baseUrl}?action=services&key=${encodeURIComponent(apiKey)}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
      headers: { Accept: 'application/json, */*' },
    })
    if (!response.ok) throw new Error(`API request failed: ${response.status}`)
    const data = await response.json()
    return (data['Service List'] as SickwService[]) || []
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function checkIMEI(
  identifier: string,
  apiKey: string,
  serviceId = '0'
): Promise<ImeiCheckResult> {
  if (!identifier || !apiKey) {
    return { success: false, error: 'IMEI/SN and API key are required', identifier }
  }

  const isIMEI = /^\d{15}$/.test(identifier)
  const isSerialNumber = /^[A-Z0-9]{10,12}$/i.test(identifier)
  if (!isIMEI && !isSerialNumber) {
    return {
      success: false,
      error: 'Invalid format. Enter 15-digit IMEI or 10-12 character Serial Number',
      identifier,
    }
  }

  const baseUrl = getSickwProxyUrl()
  const url = `${baseUrl}?format=beta&key=${encodeURIComponent(apiKey)}&imei=${encodeURIComponent(identifier)}&service=${encodeURIComponent(serviceId)}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
      headers: { Accept: 'application/json, */*' },
    })
    if (!response.ok) throw new Error(`API request failed: ${response.status}`)
    const data = await response.json()
    if (data.status === 'error' || data.error) {
      throw new Error(data.result || data.error || 'API returned an error')
    }

    const result = (data.result || {}) as Record<string, unknown>
    const getResultValue = (...keys: string[]) => {
      for (const key of keys) {
        if (result[key] !== undefined && result[key] !== null && result[key] !== '') {
          return String(result[key])
        }
        const foundKey = Object.keys(result).find((k) => k.toLowerCase() === key.toLowerCase())
        if (
          foundKey &&
          result[foundKey] !== undefined &&
          result[foundKey] !== null &&
          result[foundKey] !== ''
        ) {
          return String(result[foundKey])
        }
      }
      return null
    }

    const identifierValue = String(data.imei || identifier)
    return {
      success: true,
      imei: getResultValue('IMEI', 'imei') || (isIMEI ? identifier : null),
      imei2: getResultValue('IMEI2', 'imei2'),
      meid: getResultValue('MEID', 'meid'),
      serialNumber:
        getResultValue('Serial Number', 'Serial', 'SN', 'serial') ||
        (isSerialNumber ? identifier : null),
      identifier: identifierValue,
      identifierType: isIMEI ? 'IMEI' : 'Serial Number',
      modelDescription: getResultValue('Model Description', 'model description'),
      model: getResultValue('Model Name', 'Model', 'model') || getResultValue('Model Code'),
      modelCode: getResultValue('Model Code', 'model code'),
      brand: getResultValue('Manufacturer', 'Brand', 'manufacturer', 'brand'),
      storage: getResultValue('Storage', 'Capacity', 'storage', 'capacity'),
      color: getResultValue('Color', 'colour', 'color'),
      iCloudLock: getResultValue('iCloud Lock', 'icloud lock'),
      iCloudStatus: getResultValue('iCloud Status', 'icloud status'),
      fmiStatus:
        getResultValue('Find My iPhone', 'FMI', 'iCloud Lock', 'iCloud Status', 'Find My') ||
        getResultValue('iCloud Lock') ||
        'Unknown',
      simLockStatus:
        getResultValue('Sim-Lock Status', 'SIM-Lock Status', 'SIM Lock', 'simlock') || 'Unknown',
      lockedCarrier: getResultValue('Locked Carrier', 'Carrier Lock'),
      activationStatus: getResultValue('Activation Status', 'Activation') || 'Unknown',
      registrationStatus: getResultValue('Registration Status'),
      warrantyStatus: getResultValue('Warranty Status', 'Warranty'),
      telephoneSupport: getResultValue('Telephone Technical Support', 'Technical Support'),
      repairsServiceCoverage: getResultValue('Repairs and Service Coverage'),
      estimatedPurchaseDate: getResultValue('Estimated Purchase Date'),
      appleCareEligible: getResultValue('AppleCare Eligible', 'AppleCare'),
      mdmStatus: getResultValue('MDM Status', 'MDM', 'Mobile Device Management'),
      mdmEnrollment: getResultValue('MDM Enrollment', 'Enrollment Status'),
      supervisionStatus: getResultValue('Supervision Status', 'Supervised'),
      demoUnit: getResultValue('Demo Unit'),
      refurbishedDevice: getResultValue('Refurbished Device'),
      balance: data.balance != null ? String(data.balance) : null,
      price: data.price != null ? String(data.price) : null,
      serviceId: data.service != null ? String(data.service) : serviceId,
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Request timeout. Please try again.'
          : err.message
        : 'Failed to check device information'
    return { success: false, error: message, identifier }
  } finally {
    clearTimeout(timeoutId)
  }
}
