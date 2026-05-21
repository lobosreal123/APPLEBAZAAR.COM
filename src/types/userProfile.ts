/** Applebazaar customer profile at users/{uid} */
export type UserProfile = {
  username: string
  phone: string
  email: string
  createdAt: string
  updatedAt?: string
  source?: string
}

export type SignUpProfileInput = {
  username: string
  phone: string
}
