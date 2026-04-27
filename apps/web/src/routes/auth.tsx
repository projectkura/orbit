import { useEffect, useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  FingerPrintIcon,
} from "@hugeicons/core-free-icons"
import {
  emergencyAdminEmail,
  emergencyAdminStatusSchema,
  emergencyAdminUsername,
  setupProgressEventSchema,
  type EmergencyAdminStatus,
  type SetupProgressEvent,
} from "@orbit/shared/emergency-admin"

import type { OrbitSessionUser } from "@/lib/auth-types"
import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Button } from "@/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/card"
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import {
  Progress,
  ProgressLabel,
} from "@/components/progress"
import { Separator } from "@/components/separator"
import { Spinner } from "@/components/spinner"
import { Discord } from "@/components/ui/svgs/discord"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Google } from "@/components/ui/svgs/google"

export const Route = createFileRoute("/auth")({ component: AuthPage })

function AuthPage() {
  const session = authClient.useSession()
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [emergencyStatus, setEmergencyStatus] =
    useState<EmergencyAdminStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [emergencyPassword, setEmergencyPassword] = useState("")
  const [emergencyPasswordConfirm, setEmergencyPasswordConfirm] = useState("")
  const [setupEvents, setSetupEvents] = useState<SetupProgressEvent[]>([])
  const [setupProgress, setSetupProgress] = useState(0)

  const user = (session.data?.user as OrbitSessionUser | undefined) ?? null
  const continuePath = user?.role === "admin" ? "/admin" : "/app"
  const passkeySupported =
    typeof window !== "undefined" && "PublicKeyCredential" in window

  useEffect(() => {
    let mounted = true

    async function loadEmergencyStatus() {
      try {
        const response = await fetch("/api/emergency-admin", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Failed to load sign-in state (${response.status})`)
        }

        const data = emergencyAdminStatusSchema.parse(await response.json())

        if (mounted) {
          setEmergencyStatus(data)
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to reach Orbit setup."
          )
          setEmergencyStatus(null)
        }
      } finally {
        if (mounted) {
          setStatusLoading(false)
        }
      }
    }

    void loadEmergencyStatus()

    return () => {
      mounted = false
    }
  }, [])

  const isFreshInstall = emergencyStatus?.freshInstall === true
  const showEmergencyAdminSignIn = emergencyStatus?.hasEmergencyAdmin === true
  const latestSetupEvent = setupEvents.at(-1) ?? null
  const emergencyButtonLabel = useMemo(() => {
    if (pendingAction === "emergency-setup") {
      return "Initializing Orbit…"
    }

    if (pendingAction === "emergency-signin") {
      return "Signing in…"
    }

    return isFreshInstall ? "Create master admin" : "Sign in as admin"
  }, [isFreshInstall, pendingAction])

  async function signInWithProvider(
    provider: "google" | "github" | "discord"
  ) {
    try {
      setError(null)
      setPendingAction(provider)

      await authClient.signIn.social({
        provider,
        callbackURL: "/post-auth",
        errorCallbackURL: "/auth",
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to continue with ${provider}.`
      )
      setPendingAction(null)
    }
  }

  async function signInWithCfx() {
    try {
      setError(null)
      setPendingAction("cfx")

      await authClient.signIn.oauth2({
        providerId: "cfx",
        callbackURL: "/post-auth",
        errorCallbackURL: "/auth",
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to continue with Cfx.re."
      )
      setPendingAction(null)
    }
  }

  async function signInWithPasskey() {
    if (!passkeySupported) {
      setError("Passkeys are not supported in this browser.")
      return
    }

    setError(null)
    setPendingAction("passkey")

    const result = await authClient.signIn.passkey()

    if (result.error) {
      setError(result.error.message ?? "Passkey sign in failed.")
      setPendingAction(null)
      return
    }

    window.location.assign("/post-auth")
  }

  async function handleEmergencyAdminSubmit() {
    if (emergencyPassword.length < 8) {
      setError("Use at least 8 characters for the admin password.")
      return
    }

    if (isFreshInstall && emergencyPassword !== emergencyPasswordConfirm) {
      setError("The passwords do not match.")
      return
    }

    setError(null)

    if (isFreshInstall) {
      setPendingAction("emergency-setup")
      setSetupEvents([])
      setSetupProgress(0)

      try {
        const response = await fetch("/api/emergency-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password: emergencyPassword }),
        })

        if (!response.ok) {
          throw new Error(await readError(response, "Unable to initialize Orbit."))
        }

        const finalEvent = await consumeSetupStream(response, (event) => {
          setSetupProgress(event.progress)
          setSetupEvents((current) => [...current, event])
        })

        if (!finalEvent || finalEvent.type !== "complete") {
          throw new Error(finalEvent?.message ?? "Orbit setup did not finish.")
        }

        setSetupEvents((current) => [
          ...current,
          {
            type: "stage",
            phase: "sign-in",
            message: "Signing in as the master admin.",
            progress: 100,
          },
        ])

        const signInResult = await authClient.signIn.email({
          email: emergencyAdminEmail,
          password: emergencyPassword,
          callbackURL: "/post-auth",
          rememberMe: true,
        })

        if (signInResult.error) {
          throw new Error(signInResult.error.message ?? "Admin sign in failed.")
        }

        window.location.assign("/post-auth")
        return
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Orbit setup failed."
        )
        setPendingAction(null)
        return
      }
    }

    setPendingAction("emergency-signin")

    try {
      const result = await authClient.signIn.email({
        email: emergencyAdminEmail,
        password: emergencyPassword,
        callbackURL: "/post-auth",
        rememberMe: true,
      })

      if (result.error) {
        throw new Error(result.error.message ?? "Admin sign in failed.")
      }

      window.location.assign("/post-auth")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Emergency admin access failed."
      )
      setPendingAction(null)
    }
  }

  if (session.isPending || statusLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </main>
    )
  }

  if (session.data) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6">
        <div className="flex w-full max-w-xs flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">Orbit</h1>
            <p className="text-xs text-muted-foreground">
              You&apos;re already signed in
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              render={<Link to={continuePath} />}
            >
              Continue to app
              <HugeiconsIcon icon={ArrowRight01Icon} className="ml-auto size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              render={<Link to="/" />}
            >
              Back to home
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (isFreshInstall) {
    return (
      <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(102,51,153,0.08),transparent_35%),linear-gradient(180deg,transparent,rgba(15,23,42,0.03))] px-6 py-10">
        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="border-border/80 bg-card/95 shadow-2xl shadow-black/5">
            <CardHeader className="space-y-4">
              <div className="space-y-1">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  First-run setup
                </p>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Create the master admin password
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6">
                  On a fresh Docker install, Orbit will migrate the database,
                  create the fixed recovery account
                  <span className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
                    {emergencyAdminUsername}
                  </span>
                  and sign you in automatically.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-password">Master password</Label>
                  <Input
                    id="emergency-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Choose a strong password"
                    disabled={pendingAction === "emergency-setup"}
                    value={emergencyPassword}
                    onChange={(event) => setEmergencyPassword(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emergency-password-confirm">
                    Confirm password
                  </Label>
                  <Input
                    id="emergency-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat the password"
                    disabled={pendingAction === "emergency-setup"}
                    value={emergencyPasswordConfirm}
                    onChange={(event) =>
                      setEmergencyPasswordConfirm(event.target.value)
                    }
                  />
                </div>
              </div>

              {emergencyStatus?.statusMessage ? (
                <Alert
                  variant={
                    emergencyStatus.databaseReachable ? "default" : "destructive"
                  }
                >
                  <AlertTitle>
                    {emergencyStatus.databaseReachable
                      ? "Automatic database setup"
                      : "Database unavailable"}
                  </AlertTitle>
                  <AlertDescription>
                    {emergencyStatus.statusMessage}
                  </AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Setup failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Alert>
                <AlertTitle>How this account is used</AlertTitle>
                <AlertDescription>
                  This is the built-in break-glass admin. Use it for recovery or
                  initial setup, then keep daily access on your normal accounts.
                </AlertDescription>
              </Alert>
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                No container shell required. Orbit handles the migration and
                account bootstrap here.
              </p>
              <Button
                size="lg"
                disabled={pendingAction !== null}
                onClick={() => void handleEmergencyAdminSubmit()}
              >
                {pendingAction === "emergency-setup" ? (
                  <Spinner className="size-3.5" />
                ) : null}
                {emergencyButtonLabel}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Setup activity
                  </CardTitle>
                  <CardDescription>
                    Live progress from the bootstrap process.
                  </CardDescription>
                </div>
                <span className="rounded-full border border-border/80 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {latestSetupEvent?.phase ?? "idle"}
                </span>
              </div>

              <Progress value={setupProgress || 0}>
                <ProgressLabel>
                  {latestSetupEvent?.message ?? "Waiting for setup to start."}
                </ProgressLabel>
              </Progress>
              <p className="text-right text-xs text-muted-foreground">
                {Math.round(setupProgress || 0)}%
              </p>
            </CardHeader>

            <CardContent className="space-y-3">
              {setupEvents.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  After you submit the password, Orbit will check the database,
                  run the auth migrations, create the admin account, and sign you
                  in.
                </p>
              ) : (
                <div className="space-y-2">
                  {setupEvents.map((event, index) => (
                    <div
                      key={`${event.phase}-${index}`}
                      className="rounded-xl border border-border/70 bg-background/70 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          {event.message}
                        </p>
                        <span className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                          {event.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-base font-semibold tracking-tight">Orbit</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to your instance
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithProvider("google")}
          >
            <Google className="size-3.5" />
            {pendingAction === "google"
              ? "Redirecting…"
              : "Continue with Google"}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithProvider("github")}
          >
            <GithubDark className="size-3.5" />
            {pendingAction === "github"
              ? "Redirecting…"
              : "Continue with GitHub"}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithProvider("discord")}
          >
            <Discord className="size-3.5" />
            {pendingAction === "discord"
              ? "Redirecting…"
              : "Continue with Discord"}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithCfx()}
          >
            <span className="flex size-3.5 items-center justify-center text-[0.5rem] font-bold leading-none">
              Cfx
            </span>
            {pendingAction === "cfx"
              ? "Redirecting…"
              : "Continue with Cfx.re"}
          </Button>

          <Separator className="my-1" />

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithPasskey()}
          >
            <HugeiconsIcon icon={FingerPrintIcon} className="size-3.5" />
            {pendingAction === "passkey"
              ? "Waiting for passkey…"
              : "Continue with Passkey"}
          </Button>
        </div>

        {showEmergencyAdminSignIn ? (
          <Card className="w-full border-dashed border-amber-300/70 bg-amber-50/40 dark:border-amber-800/80 dark:bg-amber-950/20">
            <CardHeader className="space-y-2 pb-4">
              <CardTitle className="text-sm font-semibold tracking-tight">
                Emergency admin access
              </CardTitle>
              <CardDescription className="text-xs leading-5">
                This is the local fallback account for when OAuth is unavailable.
                It is not meant for day-to-day use.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="emergency-admin-password">Admin password</Label>
                <Input
                  id="emergency-admin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter the local admin password"
                  value={emergencyPassword}
                  onChange={(event) => setEmergencyPassword(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={pendingAction !== null}
                onClick={() => void handleEmergencyAdminSubmit()}
              >
                {pendingAction === "emergency-signin" ? (
                  <Spinner className="size-3.5" />
                ) : null}
                {emergencyButtonLabel}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="w-full">
            <AlertTitle>Authentication failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </main>
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

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

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
  const events: SetupProgressEvent[] = []
  const lines = buffer.split("\n")
  const remainder = flush ? "" : (lines.pop() ?? "")

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    events.push(setupProgressEventSchema.parse(JSON.parse(trimmed)))
  }

  if (flush) {
    const tail = remainder.trim()

    if (tail) {
      events.push(setupProgressEventSchema.parse(JSON.parse(tail)))
    }
  }

  return {
    buffer: remainder,
    events,
  }
}

async function readError(response: Response, fallback: string) {
  try {
    const text = await response.text()
    return text || fallback
  } catch {
    return fallback
  }
}
