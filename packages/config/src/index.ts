export type OrbitConfigMode = "memory" | "edge"
export type OrbitDeploymentMode = "selfhosted" | "vercel"

export function resolveConfigMode(input?: string | null): OrbitConfigMode {
  return input === "edge" ? "edge" : "memory"
}

export function resolveDeploymentMode(
  input?: string | null
): OrbitDeploymentMode {
  return input === "vercel" ? "vercel" : "selfhosted"
}
