import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { checkIMEI, getServices, getSickwAPIKey, type ImeiCheckResult, type SickwService } from '../services/sickwService'
import { getImeiPricing } from '../services/imeiPricingService'
import { deductFreeCheckBalance, hasFreeCheckBalance, isFreeCheckConfigured } from '../services/freeCheckService'

function isKnown(value: unknown): value is string {
  if (value == null) return false
  const s = String(value).trim()
  if (!s) return false
  const lower = s.toLowerCase()
  return lower !== 'unknown' && lower !== 'n/a' && lower !== 'null' && lower !== '-'
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!isKnown(value)) return null
  return (
    <div className="free-check-result-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function FreeImeiCheck() {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [imei, setImei] = useState('')
  const [serviceId, setServiceId] = useState('0')
  const [services, setServices] = useState<SickwService[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loadingServices, setLoadingServices] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkProgress, setCheckProgress] = useState(0)
  const [hasKey, setHasKey] = useState(false)
  const [result, setResult] = useState<ImeiCheckResult | null>(null)
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingServices(true)
    ;(async () => {
      try {
        const apiKey = getSickwAPIKey()
        setHasKey(!!apiKey)
        if (!apiKey) {
          setServices([])
          return
        }
        const [allServices, pricing] = await Promise.all([getServices(apiKey), getImeiPricing()])
        if (cancelled) return
        const visibility = pricing.freeCheckVisibility || {}
        const visible = allServices.filter((s) => visibility[String(s.service)] === true)
        setServices(visible)
        const nextPrices: Record<string, number> = {}
        for (const s of visible) {
          const custom = pricing.services?.[String(s.service)]
          nextPrices[String(s.service)] =
            custom != null ? Number(custom) : parseFloat(String(s.price)) || 0
        }
        setPrices(nextPrices)
        if (visible.length > 0) setServiceId(String(visible[0].service))
      } catch (err) {
        console.error('[FreeCheck] load services failed', err)
        if (!cancelled) setServices([])
      } finally {
        if (!cancelled) setLoadingServices(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!checking) {
      setCheckProgress(0)
      return
    }
    setCheckProgress(8)
    const id = window.setInterval(() => {
      setCheckProgress((p) => {
        if (p >= 92) return p
        if (p < 40) return p + 7
        if (p < 70) return p + 3.5
        return p + 1.2
      })
    }, 280)
    return () => window.clearInterval(id)
  }, [checking])

  const handleInput = (raw: string) => {
    let value = raw.toUpperCase()
    if (/^\d*$/.test(value)) value = value.slice(0, 15)
    else value = value.replace(/[^A-Z0-9]/g, '').slice(0, 12)
    setImei(value)
  }

  const valid =
    /^\d{15}$/.test(imei.trim()) || /^[A-Z0-9]{10,12}$/i.test(imei.trim())

  const runCheck = async () => {
    if (!valid || checking) return
    const apiKey = getSickwAPIKey()
    if (!apiKey) {
      setResult({
        success: false,
        error: 'Service is currently under maintenance. Please try again later.',
        identifier: imei.trim(),
      })
      setShowResult(true)
      setOpen(false)
      return
    }

    setChecking(true)
    setResult(null)
    try {
      const price = prices[serviceId] || 0
      if (price > 0) {
        if (!isFreeCheckConfigured()) {
          setResult({
            success: false,
            error: 'Service is currently under maintenance. Please try again later.',
            identifier: imei.trim(),
          })
          setShowResult(true)
          setOpen(false)
          return
        }
        const balanceCheck = await hasFreeCheckBalance(price)
        if (!balanceCheck.hasBalance) {
          setResult({
            success: false,
            error: 'Service is currently under maintenance. Please try again later.',
            identifier: imei.trim(),
          })
          setShowResult(true)
          setOpen(false)
          return
        }
      }

      const check = await checkIMEI(imei.trim().toUpperCase(), apiKey, serviceId)
      const display: ImeiCheckResult = {
        ...check,
        serviceId: check.serviceId || serviceId,
        identifier: imei.trim().toUpperCase(),
        identifierType: /^\d{15}$/.test(imei.trim()) ? 'IMEI' : 'Serial Number',
      }

      if (check.success && price > 0) {
        try {
          await deductFreeCheckBalance(price)
        } catch (err) {
          console.warn('[FreeCheck] balance deduct failed', err)
        }
      }

      setCheckProgress(100)
      setResult(display)
      setShowResult(true)
      setOpen(false)
    } catch {
      setCheckProgress(100)
      setResult({
        success: false,
        error: 'Service is currently under maintenance. Please try again later.',
        identifier: imei.trim(),
      })
      setShowResult(true)
      setOpen(false)
    } finally {
      window.setTimeout(() => setChecking(false), 180)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`free-check-toggle ${open ? 'open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        title="Free IMEI / Serial check"
      >
        IMEI Check
      </button>

      {open &&
        createPortal(
          <div
            className="free-check-overlay"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget && !checking) setOpen(false)
            }}
          >
            <div id={panelId} className="free-check-panel" role="dialog" aria-modal="true" aria-label="Free IMEI check">
              <div className="free-check-panel-head">
                <div>
                  <h3>Free IMEI / SN Check</h3>
                  <p className="free-check-panel-sub">POS free-check · no login needed</p>
                </div>
                <button
                  type="button"
                  className="free-check-close"
                  aria-label="Close"
                  disabled={checking}
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="free-check-panel-body">
                {!hasKey && !loadingServices && (
                  <p className="free-check-notice">Service is currently under maintenance.</p>
                )}

                <label className="free-check-label">
                  Service
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    disabled={loadingServices || !hasKey || services.length === 0 || checking}
                  >
                    {loadingServices ? (
                      <option>Loading…</option>
                    ) : services.length === 0 ? (
                      <option value="0">No free services enabled</option>
                    ) : (
                      services.map((s) => {
                        const p = prices[String(s.service)] ?? 0
                        return (
                          <option key={s.service} value={String(s.service)}>
                            {String(s.name).toUpperCase()}
                            {p > 0 ? ` $${p}` : ' · Free'}
                          </option>
                        )
                      })
                    )}
                  </select>
                </label>

                <label className="free-check-label">
                  IMEI or Serial Number
                  <input
                    type="text"
                    value={imei}
                    onChange={(e) => handleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void runCheck()
                      }
                    }}
                    placeholder="15-digit IMEI or 10–12 char SN"
                    maxLength={15}
                    autoComplete="off"
                    enterKeyHint="search"
                    disabled={checking}
                  />
                </label>

                <button
                  type="button"
                  className="btn-primary free-check-submit"
                  disabled={!valid || checking || !hasKey || services.length === 0}
                  onClick={() => void runCheck()}
                >
                  {checking ? 'Checking…' : 'Check device'}
                </button>

                {checking && (
                  <div
                    className="free-check-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(checkProgress)}
                    aria-label="Checking device"
                  >
                    <div className="free-check-progress-track">
                      <div className="free-check-progress-fill" style={{ width: `${checkProgress}%` }} />
                    </div>
                    <p className="free-check-progress-label">Checking device… {Math.round(checkProgress)}%</p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {showResult &&
        result &&
        createPortal(
          <div
            className="free-check-result-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="IMEI check result"
            onClick={(e) => e.target === e.currentTarget && setShowResult(false)}
          >
            <div className={`free-check-result-modal ${result.success ? 'is-success' : 'is-error'}`}>
              <div className="free-check-result-glow" aria-hidden />
              <div className="free-check-result-head">
                <div className="free-check-result-head-text">
                  <p className="free-check-result-eyebrow">
                    {result.success ? 'Device check complete' : 'Check unavailable'}
                  </p>
                  <h3>
                    {result.identifierType || 'IMEI'}: {result.identifier || result.imei || '—'}
                  </h3>
                </div>
                <button
                  type="button"
                  className="free-check-close"
                  aria-label="Close result"
                  onClick={() => setShowResult(false)}
                >
                  ×
                </button>
              </div>
              <div className="free-check-result-scroll">
                {result.success ? (
                  <div className="free-check-result-body">
                    <Row label="Model" value={result.modelDescription || result.model} />
                    <Row label="Model code" value={result.modelCode} />
                    <Row label="Color" value={result.color} />
                    <Row label="Storage" value={result.storage} />
                    <Row label="iCloud / FMI" value={result.iCloudLock || result.fmiStatus} />
                    <Row label="SIM lock" value={result.simLockStatus} />
                    <Row label="Carrier" value={result.lockedCarrier} />
                    <Row label="Warranty" value={result.warrantyStatus} />
                    <Row label="Purchase date" value={result.estimatedPurchaseDate} />
                    <Row label="MDM" value={result.mdmStatus || result.supervisionStatus} />
                    <Row label="IMEI" value={result.imei} />
                    <Row label="IMEI2" value={result.imei2} />
                    <Row label="Serial" value={result.serialNumber} />
                  </div>
                ) : (
                  <p className="free-check-error">{result.error || 'Unable to check device.'}</p>
                )}
                <button type="button" className="btn-primary free-check-result-done" onClick={() => setShowResult(false)}>
                  Done
                </button>
                <p className="free-check-powered">Powered by APPLE BAZAAR (Lobos)</p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
