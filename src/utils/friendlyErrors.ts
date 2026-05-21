/** Map Firebase / network errors to plain language for customers. */

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact support if you need help.',
  'auth/user-not-found': 'No account found with this email. Check the email or sign up.',
  'auth/wrong-password': 'Incorrect password. Try again or reset your password.',
  'auth/invalid-credential': 'Incorrect email or password. Please check and try again.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in instead.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled. Contact support.',
  'auth/missing-password': 'Please enter your password.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/invalid-login-credentials': 'Incorrect email or password. Please check and try again.',
}

const FIRESTORE_MESSAGES: Record<string, string> = {
  'permission-denied': 'You do not have permission to do that. Try signing in again.',
  unavailable: 'Service is temporarily unavailable. Please try again in a moment.',
  'not-found': 'The requested information could not be found.',
  'already-exists': 'This record already exists.',
  cancelled: 'Request was cancelled. Please try again.',
  'resource-exhausted': 'Too many requests. Please wait and try again.',
  'failed-precondition':
    'Orders are still setting up on our side. Please refresh the page in a moment.',
}

type ErrorContext = 'signIn' | 'signUp' | 'resetPassword' | 'profile' | 'order' | 'orders' | 'general'

export function getFirebaseErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: string }).code
    return code ? String(code) : null
  }
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return msg ? extractFirebaseCode(msg) : null
}

const CONTEXT_FALLBACK: Record<ErrorContext, string> = {
  signIn: 'Could not sign in. Check your email and password.',
  signUp: 'Could not create your account. Please check your details and try again.',
  resetPassword: 'Could not send a reset email. Check the email address and try again.',
  profile: 'Could not save your profile. Please try again.',
  order: 'Could not place your order. Please try again.',
  orders: 'Could not load your orders. Please try again.',
  general: 'Something went wrong. Please try again.',
}

function extractFirebaseCode(message: string): string | null {
  const authMatch = message.match(/\(auth\/([^)]+)\)/)
  if (authMatch) return `auth/${authMatch[1]}`
  const fsMatch = message.match(/\(firestore\/([^)]+)\)/) ?? message.match(/code=([^,\s]+)/)
  if (fsMatch) return fsMatch[1]
  return null
}

function isInternalMessage(message: string): boolean {
  return (
    message.includes('Firebase:') ||
    message.includes('auth/') ||
    message.includes('firestore/') ||
    message.includes('PERMISSION_DENIED') ||
    message.startsWith('Missing or insufficient permissions')
  )
}

/**
 * Turn thrown errors into short, user-safe messages (no Firebase codes or stack traces).
 */
export function getFriendlyErrorMessage(
  err: unknown,
  context: ErrorContext = 'general'
): string {
  if (err == null) return CONTEXT_FALLBACK[context]

  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: string }).code)
      : null

  if (code) {
    if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code]
    if (FIRESTORE_MESSAGES[code]) return FIRESTORE_MESSAGES[code]
    if (code.startsWith('auth/')) {
      return CONTEXT_FALLBACK[context === 'general' ? 'signIn' : context]
    }
  }

  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''

  const trimmed = raw.trim()
  if (trimmed && !isInternalMessage(trimmed)) {
    return trimmed
  }

  const fromMsg = trimmed ? extractFirebaseCode(trimmed) : null
  if (fromMsg) {
    if (AUTH_MESSAGES[fromMsg]) return AUTH_MESSAGES[fromMsg]
    if (FIRESTORE_MESSAGES[fromMsg]) return FIRESTORE_MESSAGES[fromMsg]
  }

  return CONTEXT_FALLBACK[context]
}
