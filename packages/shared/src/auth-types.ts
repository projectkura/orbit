export type OrbitRole = "user" | "admin"

export type OrbitSessionUser = {
  id: string
  email: string
  emailVerified?: boolean
  image?: string | null
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  role?: OrbitRole | null
  tosAcceptedAt?: string | Date | null
  privacyAcceptedAt?: string | Date | null
  onboardingCompletedAt?: string | Date | null
}
