export type OrbitRole = "user" | "admin"

export type OrbitSessionUser = {
  id: string
  email: string
  emailVerified?: boolean
  image?: string | null
  name?: string | null
  username?: string | null
  role?: OrbitRole | null
}
