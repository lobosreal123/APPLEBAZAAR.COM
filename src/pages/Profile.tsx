import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getFriendlyErrorMessage } from '../utils/friendlyErrors'

const formStyle: React.CSSProperties = {
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}

export default function Profile() {
  const { user, profile, profileLoading, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const startEdit = () => {
    setUsername(profile?.username ?? '')
    setPhone(profile?.phone ?? '')
    setError('')
    setSaved(false)
    setEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({ username, phone })
      setSaved(true)
      setEditing(false)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'profile'))
    } finally {
      setSaving(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="profile-page">
        <p style={{ color: 'var(--text-muted)' }}>Loading profile…</p>
      </div>
    )
  }

  const displayName = profile?.username?.trim() || user?.email?.split('@')[0] || 'Account'

  return (
    <div className="profile-page">
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to shop
        </Link>
      </p>
      <h1 className="section-title">My profile</h1>

      <div className="profile-card">
        <div className="profile-card-header">
          <span className="profile-avatar" aria-hidden>
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2 className="profile-card-name">{displayName}</h2>
            <p className="profile-card-email">{user?.email ?? '—'}</p>
          </div>
        </div>

        {!profile && !editing && (
          <p className="profile-missing-hint">
            Complete your profile so checkout can use your details.
          </p>
        )}

        {saved && (
          <p className="profile-saved-msg" role="status">
            Profile updated.
          </p>
        )}
        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

        {editing ? (
          <form style={formStyle} onSubmit={handleSave}>
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
            <div className="form-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="profile-details">
            <div>
              <dt>Username</dt>
              <dd>{profile?.username?.trim() || '—'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{profile?.phone?.trim() || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{profile?.email || user?.email || '—'}</dd>
            </div>
            {profile?.createdAt && (
              <div>
                <dt>Member since</dt>
                <dd>
                  {new Date(profile.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            )}
          </dl>
        )}

        {!editing && (
          <button type="button" className="btn-primary profile-edit-btn" onClick={startEdit}>
            {profile?.username ? 'Edit profile' : 'Set up profile'}
          </button>
        )}
      </div>

      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/my-orders">View my orders</Link>
      </p>
    </div>
  )
}
