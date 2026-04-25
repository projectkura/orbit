export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(path.startsWith("/") ? path : `/${path}`, {
    credentials: "include",
    ...init,
  })
}
