import { useEffect, useMemo, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  masterAdminEmail,
  masterAdminStatusSchema,
  setupProgressEventSchema,
} from "@orbit/shared/master-admin"
import type {
  MasterAdminStatus,
  SetupProgressEvent,
} from "@orbit/shared/master-admin"

import { authClient } from "@/lib/auth-client"
import { getAuthCallbackUrl } from "@/lib/auth-redirect"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Button } from "@/components/button"
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import { Spinner } from "@/components/spinner"

export const Route = createFileRoute("/boot")({ component: SetupPage })

type SetupState =
  | { kind: "idle" }
  | { kind: "running"; progress: number; message: string }
  | { kind: "complete" }
  | { kind: "error"; message: string }

function SetupPage() {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const [status, setStatus] = useState<MasterAdminStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [setupState, setSetupState] = useState<SetupState>({ kind: "idle" })
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadStatus() {
      try {
        const response = await fetch("/api/master-admin", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Failed to reach the instance (${response.status}).`)
        }

        const data = masterAdminStatusSchema.parse(await response.json())

        if (mounted) {
          setStatus(data)
        }
      } catch (caughtError) {
        if (mounted) {
          setSetupState({
            kind: "error",
            message:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to reach Orbit.",
          })
        }
      } finally {
        if (mounted) {
          setStatusLoading(false)
        }
      }
    }

    void loadStatus()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (statusLoading || !status) return
    if (session.isPending) return
    if (session.data) {
      void navigate({ to: "/post-auth", replace: true })
      return
    }

    if (!status.freshInstall) {
      void navigate({ to: "/login", replace: true })
    }
  }, [navigate, session.data, session.isPending, status, statusLoading])

  const isRunning = setupState.kind === "running"
  const passwordValid = useMemo(() => {
    return password.length >= 8 && password === confirm
  }, [password, confirm])

  async function handleSubmit() {
    if (password.length < 8) {
      setSetupState({
        kind: "error",
        message: "Use at least 8 characters for the master password.",
      })
      return
    }

    if (password !== confirm) {
      setSetupState({ kind: "error", message: "The passwords do not match." })
      return
    }

    setSetupState({
      kind: "running",
      progress: 0,
      message: "Preparing setup…",
    })

    try {
      const response = await fetch("/api/master-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to initialize Orbit."))
      }

      const finalEvent = await consumeSetupStream(response, (event) => {
        setSetupState({
          kind: "running",
          progress: event.progress,
          message: event.message,
        })
      })

      if (!finalEvent || finalEvent.type !== "complete") {
        throw new Error(finalEvent?.message ?? "Orbit setup did not finish.")
      }

      setSetupState({
        kind: "running",
        progress: 100,
        message: "Signing you in…",
      })

      const signInResult = await authClient.signIn.email({
        email: masterAdminEmail,
        password,
        callbackURL: getAuthCallbackUrl("/admin"),
        rememberMe: true,
      })

      if (signInResult.error) {
        throw new Error(signInResult.error.message ?? "Admin sign in failed.")
      }

      setSetupState({ kind: "complete" })
      setExiting(true)
      window.setTimeout(() => {
        window.location.assign("/admin")
      }, 700)
    } catch (caughtError) {
      setSetupState({
        kind: "error",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Orbit setup failed.",
      })
    }
  }

  if (statusLoading || session.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </main>
    )
  }

  return (
    <main
      className={`relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-6 py-12 transition-all duration-500 ease-out ${exiting ? "opacity-0 scale-[0.985]" : "opacity-100 scale-100"
        }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,oklch(0.811_0.111_293.571_/_0.18),transparent_55%),radial-gradient(circle_at_80%_90%,oklch(0.491_0.27_292.581_/_0.12),transparent_60%)]"
      />

      <div className="flex w-full max-w-md flex-col gap-7">
        <div className="flex flex-col gap-2 text-center">

          <h1 className="text-2xl font-semibold tracking-tight">
            Create your master password
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            You'll use this to set up your account and recover access if needed. Don't lose it.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="master-password">Master password</Label>
            <Input
              id="master-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={isRunning}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="master-password-confirm">Confirm password</Label>
            <Input
              id="master-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat the password"
              disabled={isRunning}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={isRunning || !passwordValid}
            onClick={() => void handleSubmit()}
          >
            {isRunning ? <Spinner className="size-3.5" /> : null}
            {setupState.kind === "complete"
              ? "Ready"
              : isRunning
                ? "Setting up…"
                : "Continue"}
          </Button>

          {setupState.kind === "running" ? (
            <ProgressLine
              progress={setupState.progress}
              message={setupState.message}
            />
          ) : null}

          {setupState.kind === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>Setup failed</AlertTitle>
              <AlertDescription>{setupState.message}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function ProgressLine({
  progress,
  message,
}: {
  progress: number
  message: string
}) {
  const pct = Math.min(100, Math.max(0, progress))

  return (
    <div className="flex flex-col gap-2">
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{message}</span>
        <span className="tabular-nums">{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

async function consumeSetupStream(
  response: Response,
  onEvent: (event: SetupProgressEvent) => void
) {
  if (!response.body) {
    throw new Error("Orbit setup did not return a progress stream.")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let finalEvent: SetupProgressEvent | null = null

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parsed = drainSetupEventBuffer(buffer)
    buffer = parsed.buffer

    for (const event of parsed.events) {
      finalEvent = event
      onEvent(event)
    }
  }

  buffer += decoder.decode()
  const parsed = drainSetupEventBuffer(buffer, true)

  for (const event of parsed.events) {
    finalEvent = event
    onEvent(event)
  }

  return finalEvent
}

function drainSetupEventBuffer(buffer: string, flush = false) {
  const events: Array<SetupProgressEvent> = []
  const lines = buffer.split("\n")
  const remainder = flush ? "" : (lines.pop() ?? "")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    events.push(setupProgressEventSchema.parse(JSON.parse(trimmed)))
  }

  if (flush) {
    const tail = remainder.trim()
    if (tail) {
      events.push(setupProgressEventSchema.parse(JSON.parse(tail)))
    }
  }

  return { buffer: remainder, events }
}

async function readError(response: Response, fallback: string) {
  try {
    const text = await response.text()
    return text || fallback
  } catch {
    return fallback
  }
}
