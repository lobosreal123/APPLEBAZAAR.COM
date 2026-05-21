import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getFriendlyErrorMessage } from '../utils/friendlyErrors'

const formStyle: React.CSSProperties = {
  maxWidth: 360,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}

export default function SignUp() {
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signUp(email, password, {
        username: username.trim(),
        phone: phone.trim(),
      })
      navigate('/profile')
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'signUp'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="form-page">
      <h1>Sign up</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>
        Create your account with a username and phone number for orders and your profile.
      </p>
      <form style={formStyle} onSubmit={handleSubmit}>
        {error && <p style={{ color: 'var(--error)', margin: '0 0 1rem' }}>{error}</p>}
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={40}
            autoComplete="username"
            placeholder="How we address you"
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            placeholder="e.g. 0540346875"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>
      <p className="form-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
