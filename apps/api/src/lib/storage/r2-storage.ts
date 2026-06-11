import { randomUUID } from "node:crypto"
import { AwsClient } from "aws4fetch"
import { apiEnv } from "../core/env"

const MAX_UPLOAD_TTL_SECONDS = 10 * 60

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

function getR2Config(): R2Config {
  const {
    r2AccountId,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2Bucket,
    r2PublicUrl,
  } = apiEnv

  if (
    !r2AccountId ||
    !r2AccessKeyId ||
    !r2SecretAccessKey ||
    !r2Bucket ||
    !r2PublicUrl
  ) {
    throw new Response(
      JSON.stringify({
        message:
          "Cloudflare R2 is not configured. Set ORBIT_R2_ACCOUNT_ID, ORBIT_R2_ACCESS_KEY_ID, ORBIT_R2_SECRET_ACCESS_KEY, ORBIT_R2_BUCKET, and ORBIT_R2_PUBLIC_URL.",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  return {
    accountId: r2AccountId,
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
    bucket: r2Bucket,
    publicUrl: r2PublicUrl.replace(/\/+$/, ""),
  }
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
}

function getEndpoint(config: R2Config) {
  return `https://${config.accountId}.r2.cloudflarestorage.com`
}

function createR2Client(config: R2Config) {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  })
}

export function buildWorkspaceAssetKey(input: {
  workspaceId: string
  kind: string
  contentType: string
  fileName?: string
}) {
  const extension =
    input.contentType === "image/png"
      ? "png"
      : input.contentType === "image/webp"
        ? "webp"
        : input.contentType === "image/gif"
          ? "gif"
          : input.contentType === "image/jpeg"
            ? "jpg"
            : input.contentType === "image/svg+xml"
              ? "svg"
              : input.contentType === "application/json"
                ? "json"
                : input.contentType === "application/zip" ||
                    input.contentType === "application/x-zip-compressed"
                  ? "zip"
                  : input.contentType === "application/gzip"
                    ? "gz"
                    : input.contentType === "text/plain"
                      ? "txt"
                      : (() => {
                          const match = input.fileName?.match(/\.([a-z0-9]{1,12})$/i)
                          return match?.[1]?.toLowerCase() ?? "bin"
                        })()

  return `workspaces/${input.workspaceId}/${input.kind}/${randomUUID()}.${extension}`
}

export function buildPublicAssetUrl(storageKey: string) {
  const config = getR2Config()
  return `${config.publicUrl}/${encodePath(storageKey)}`
}

export async function createPresignedUpload(input: {
  storageKey: string
  contentType: string
  sizeBytes: number
  expiresInSeconds?: number
}) {
  const config = getR2Config()
  const expiresIn = Math.max(
    1,
    Math.min(MAX_UPLOAD_TTL_SECONDS, input.expiresInSeconds ?? MAX_UPLOAD_TTL_SECONDS)
  )
  const client = createR2Client(config)
  const url = new URL(
    `${getEndpoint(config)}/${encodePath(config.bucket)}/${encodePath(input.storageKey)}`
  )
  url.searchParams.set("X-Amz-Expires", String(expiresIn))

  const signed = await client.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
      },
    }),
    { aws: { signQuery: true } }
  )

  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresIn * 1000)

  return {
    uploadUrl: signed.url,
    expiresAt,
    publicUrl: buildPublicAssetUrl(input.storageKey),
    headers: {
      "Content-Type": input.contentType,
    },
  }
}

async function signR2Request(method: "HEAD" | "GET" | "DELETE", storageKey: string) {
  const config = getR2Config()
  const client = createR2Client(config)
  const signed = await client.sign(
    new Request(
      `${getEndpoint(config)}/${encodePath(config.bucket)}/${encodePath(storageKey)}`,
      {
        method,
      }
    )
  )

  return {
    url: signed.url,
    headers: Object.fromEntries(signed.headers.entries()),
  }
}

export async function headR2Object(storageKey: string) {
  const request = await signR2Request("HEAD", storageKey)
  const response = await fetch(request.url, {
    method: "HEAD",
    headers: request.headers,
  })

  if (!response.ok) {
    return null
  }

  return {
    contentType: response.headers.get("content-type"),
    sizeBytes: Number(response.headers.get("content-length") ?? "0"),
    etag: response.headers.get("etag"),
  }
}

export async function deleteR2Object(storageKey: string) {
  const request = await signR2Request("DELETE", storageKey)
  await fetch(request.url, {
    method: "DELETE",
    headers: request.headers,
  })
}

export async function readR2ObjectPrefix(storageKey: string, bytes: number) {
  const request = await signR2Request("GET", storageKey)
  const response = await fetch(request.url, {
    method: "GET",
    headers: {
      ...request.headers,
      Range: `bytes=0-${Math.max(0, bytes - 1)}`,
    },
  })

  if (!response.ok && response.status !== 206) {
    return null
  }

  return new Uint8Array(await response.arrayBuffer())
}
