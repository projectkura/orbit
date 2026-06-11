import { masterAdminSetupSchema } from "@orbit/shared"
import { getSetupStatus, runMasterAdminBootstrap, formatSetupError } from "../lib/core/bootstrap"

export async function handleSetup(request: Request) {
  if (request.method === "GET") {
    return Response.json(await getSetupStatus())
  }

  if (request.method === "POST") {
    const status = await getSetupStatus()

    if (!status.canBootstrap) {
      return new Response("This Orbit instance is already initialized.", {
        status: 409,
      })
    }

    const body = masterAdminSetupSchema.parse(await request.json())
    return createSetupStream(body.password)
  }

  return new Response("Method not allowed", { status: 405 })
}

function createSetupStream(password: string) {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream({
      async start(controller) {
        const push = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
        }

        try {
          await runMasterAdminBootstrap(password, (event) => {
            push(event)
          })
        } catch (error) {
          push({
            type: "error",
            phase: "failed",
            message: formatSetupError(error),
            progress: 100,
          })
        } finally {
          controller.close()
        }
      },
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    }
  )
}
