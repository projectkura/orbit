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
  type EmergencyAdminStatus,
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
      } catch {
        if (mounted) {
          setEmergencyStatus({ freshInstall: false, hasEmergencyAdmin: false })
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
  const emergencyButtonLabel = useMemo(() => {
    if (pendingAction === "emergency-setup") {
      return "Creating admin account…"
    }

    if (pendingAction === "emergency-signin") {
      return "Signing in…"
    }

    return isFreshInstall ? "Create admin account" : "Sign in as admin"
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
      setError("Use at least 8 characters for the emergency admin password.")
      return
    }

    if (isFreshInstall && emergencyPassword !== emergencyPasswordConfirm) {
      setError("The passwords do not match.")
      return
    }

    setError(null)
    setPendingAction(isFreshInstall ? "emergency-setup" : "emergency-signin")

    try {
      if (isFreshInstall) {
        const response = await fetch("/api/emergency-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password: emergencyPassword }),
        })

        if (!response.ok) {
          throw new Error(await readError(response, "Unable to create admin account."))
        }
      } else {
        const result = await authClient.signIn.email({
          email: emergencyAdminEmail,
          password: emergencyPassword,
          callbackURL: "/post-auth",
          rememberMe: true,
        })

        if (result.error) {
          throw new Error(result.error.message ?? "Admin sign in failed.")
        }
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
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-lg shadow-black/5">
          <CardHeader className="space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold tracking-tight">
                Create the recovery admin
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Orbit will create a fixed local account named
                <span className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
                  {emergencyAdminUsername}
                </span>
                for break-glass access. Use it sparingly, then create your normal
                OAuth admin afterwards.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="emergency-password">Admin password</Label>
              <Input
                id="emergency-password"
                type="password"
                autoComplete="new-password"
                placeholder="Choose a strong password"
                value={emergencyPassword}
                onChange={(event) => setEmergencyPassword(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emergency-password-confirm">Confirm password</Label>
              <Input
                id="emergency-password-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat the password"
                value={emergencyPasswordConfirm}
                onChange={(event) => setEmergencyPasswordConfirm(event.target.value)}
              />
            </div>

            <Alert>
              <AlertTitle>Recommended use</AlertTitle>
              <AlertDescription>
                Keep this account as your emergency fallback. Daily admin access
                should move to a normal OAuth-backed account after setup.
              </AlertDescription>
            </Alert>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Setup failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>

          <CardFooter className="flex flex-col items-stretch gap-3">
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
            <p className="text-center text-xs leading-5 text-muted-foreground">
              This account signs in with its fixed local identity behind the
              scenes and does not depend on an external OAuth provider.
            </p>
          </CardFooter>
        </Card>
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

async function readError(response: Response, fallback: string) {
  try {
    const text = await response.text()
    return text || fallback
  } catch {
    return fallback
  }
}
