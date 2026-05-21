import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getFriendlyErrorMessage } from '../utils/friendlyErrors'

const MAX_FAILED_ATTEMPTS = 3

const formStyle: React.CSSProperties = {
  maxWidth: 360,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [resetError, setResetError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)
  const { signIn, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const showResetPassword = failedAttempts >= MAX_FAILED_ATTEMPTS

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
      setFailedAttempts(0)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'signIn'))
      setFailedAttempts((n) => n + 1)
      setResetSent(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetting(true)
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (err) {
      setResetSent(false)
      setResetError(getFriendlyErrorMessage(err, 'resetPassword'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="form-page">
      <h1>Log in</h1>
      <form style={formStyle} onSubmit={handleSubmit}>
        {error && <p style={{ color: 'var(--error)', margin: '0 0 1rem' }}>{error}</p>}
        {showResetPassword && !resetSent && (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {failedAttempts} failed attempt{failedAttempts === 1 ? '' : 's'}. You can reset your
            password below.
          </p>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>

      {showResetPassword && (
        <section
          className="login-reset-password"
          style={{
            maxWidth: 360,
            margin: '1.5rem auto 0',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--surface)',
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Reset password</h2>
          {resetSent ? (
            <p style={{ margin: 0, color: 'var(--success, #15803d)', fontSize: '0.9rem' }}>
              If an account exists for <strong>{email.trim()}</strong>, we sent a reset link to
              that inbox. Check spam if you do not see it.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                We will email a link to set a new password.
              </p>
              {resetError && (
                <p style={{ color: 'var(--error)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
                  {resetError}
                </p>
              )}
              <form style={{ ...formStyle, margin: 0 }} onSubmit={handleResetPassword}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={resetting || !email.trim()}
                >
                  {resetting ? 'Sending…' : 'Send reset email'}
                </button>
              </form>
            </>
          )}
        </section>
      )}

      <p className="form-footer">
        Don’t have an account? <Link to="/signup">Sign up</Link>
      </p>
      <p className="form-hint-muted" style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        If sign-in fails, use the message above (not red lines in the browser console). A console “400” on
        sign-in usually means the email or password is wrong.
      </p>
    </div>
  )
}
