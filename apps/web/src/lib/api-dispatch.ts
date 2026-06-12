import { handleRequest } from "../../../api/src/router"
import { prepareApiRuntime } from "../../../api/src/runtime"

const BODYLESS_METHODS = new Set(["GET", "HEAD"])

export async function dispatchApiRequest(request: Request, pathname?: string) {
  await prepareApiRuntime()

  const targetUrl = new URL(request.url)

  if (pathname) {
    targetUrl.pathname = pathname
  }

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
  }

  if (!BODYLESS_METHODS.has(request.method)) {
    init.body = await request.text()
  }

  return handleRequest(new Request(targetUrl, init))
}
