import { createHmac, timingSafeEqual } from "node:crypto"

export type InternalServiceTokenPayload = {
  iss: string
  aud: string
  sub?: string
  scope?: string[]
  iat: number
  exp: number
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, "base64")
}

function sign(input: string, secret: string) {
  return toBase64Url(createHmac("sha256", secret).update(input).digest())
}

export function createInternalServiceToken(
  payload: Omit<InternalServiceTokenPayload, "iat" | "exp"> & {
    ttlSeconds?: number
  },
  secret: string
) {
  const header = { alg: "HS256", typ: "JWT" }
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (payload.ttlSeconds ?? 60)
  const body: InternalServiceTokenPayload = {
    iss: payload.iss,
    aud: payload.aud,
    sub: payload.sub,
    scope: payload.scope,
    iat,
    exp,
  }

  const encodedHeader = toBase64Url(JSON.stringify(header))
  const encodedPayload = toBase64Url(JSON.stringify(body))
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret)

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export function verifyInternalServiceToken(
  token: string,
  secret: string,
  expected: {
    iss: string
    aud: string
    scope?: string
  }
) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".")

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Malformed internal token")
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret)

  if (
    expectedSignature.length !== encodedSignature.length ||
    !timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(encodedSignature, "utf8")
    )
  ) {
    throw new Error("Invalid internal token signature")
  }

  const payload = JSON.parse(
    fromBase64Url(encodedPayload).toString("utf8")
  ) as InternalServiceTokenPayload

  const now = Math.floor(Date.now() / 1000)

  if (payload.iss !== expected.iss) {
    throw new Error("Invalid internal token issuer")
  }

  if (payload.aud !== expected.aud) {
    throw new Error("Invalid internal token audience")
  }

  if (payload.exp <= now) {
    throw new Error("Internal token expired")
  }

  if (expected.scope && !payload.scope?.includes(expected.scope)) {
    throw new Error("Missing internal token scope")
  }

  return payload
}
