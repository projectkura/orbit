function getOrigin() {
  if (typeof window === "undefined") {
    return ""
  }

  return window.location.origin
}

export function getAuthCallbackUrl(path: string) {
  return `${getOrigin()}${path}`
}
